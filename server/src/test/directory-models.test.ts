import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

// The exact compound index design.md D8 requires on both directory models.
// Field order matters for a compound index, so scenarios below compare a
// JSON-serialized form (which preserves key order) rather than a plain
// deepEqual (which would not).
const EXPECTED_DIRECTORY_INDEX_KEY = JSON.stringify({
  status: 1,
  lastName: 1,
  firstName: 1,
  _id: 1,
})

describe('directory models (contacts, employees)', () => {
  let testEnvironment: TestEnvironment

  let ContactModel: (typeof import('../modules/directory/contact.model.ts'))['ContactModel']
  let EmployeeModel: (typeof import('../modules/directory/employee.model.ts'))['EmployeeModel']

  before(async () => {
    // Per design.md D10: DB_HOST must point at the disposable in-memory
    // database before anything that reaches env.ts — including the
    // Mongoose client and any model — is imported.
    testEnvironment = await startTestEnvironment()

    const { connectToMongo } = await import('../shared/infra/mongoose/client.ts')
    await connectToMongo()

    ;({ ContactModel } = await import('../modules/directory/contact.model.ts'))
    ;({ EmployeeModel } = await import('../modules/directory/employee.model.ts'))

    // Mongoose builds declared indexes asynchronously in the background;
    // Model.init() resolves once that has finished, so the index
    // assertions below aren't racing the background build.
    await Promise.all([ContactModel.init(), EmployeeModel.init()])
  })

  after(async () => {
    await stopTestEnvironment(testEnvironment)
  })

  it('binds explicitly to the "contacts" and "employees" collection names', () => {
    assert.equal(ContactModel.collection.collectionName, 'contacts')
    assert.equal(EmployeeModel.collection.collectionName, 'employees')
  })

  it('defaults a contact status to "active" when omitted', () => {
    const contact = new ContactModel({
      firstName: 'Default',
      lastName: 'Status',
      email: 'default-status-contact@example.test',
    })

    assert.equal(contact.status, 'active')
  })

  it('defaults an employee status to "active" and canHostEvents to false when omitted', () => {
    const employee = new EmployeeModel({
      firstName: 'Default',
      lastName: 'Eligibility',
      email: 'default-eligibility-employee@example.test',
      position: 'Tester',
      department: 'QA',
    })

    assert.equal(employee.status, 'active')
    assert.equal(employee.canHostEvents, false)
  })

  it('rejects a status outside the closed active|inactive lifecycle on both models', async () => {
    const contact = new ContactModel({
      firstName: 'Bad',
      lastName: 'Status',
      email: 'bad-status-contact@example.test',
      status: 'pending',
    })
    const employee = new EmployeeModel({
      firstName: 'Bad',
      lastName: 'Status',
      email: 'bad-status-employee@example.test',
      position: 'Tester',
      department: 'QA',
      status: 'pending',
    })

    await assert.rejects(() => contact.validate(), 'expected an invalid contact status to fail validation')
    await assert.rejects(() => employee.validate(), 'expected an invalid employee status to fail validation')
  })

  it('declares the exact { status, lastName, firstName, _id } index on both directory models', async () => {
    const contactIndexes = await ContactModel.collection.indexes()
    const employeeIndexes = await EmployeeModel.collection.indexes()

    assert.ok(
      contactIndexes.some((index) => JSON.stringify(index.key) === EXPECTED_DIRECTORY_INDEX_KEY),
      `expected contacts to declare ${EXPECTED_DIRECTORY_INDEX_KEY}, found: ${JSON.stringify(contactIndexes)}`,
    )
    assert.ok(
      employeeIndexes.some((index) => JSON.stringify(index.key) === EXPECTED_DIRECTORY_INDEX_KEY),
      `expected employees to declare ${EXPECTED_DIRECTORY_INDEX_KEY}, found: ${JSON.stringify(employeeIndexes)}`,
    )
  })

  it('declares no unique index touching email on either directory model', async () => {
    const contactIndexes = await ContactModel.collection.indexes()
    const employeeIndexes = await EmployeeModel.collection.indexes()

    for (const index of [...contactIndexes, ...employeeIndexes]) {
      if ('email' in index.key) {
        assert.notEqual(
          index.unique,
          true,
          `expected no unique index touching email; found: ${JSON.stringify(index)}`,
        )
      }
    }
  })
})
