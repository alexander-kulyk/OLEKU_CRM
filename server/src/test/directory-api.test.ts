import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { Express } from 'express'
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestEnvironment,
} from './support/test-environment.ts'

function listen(app: Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0)

    server.once('error', reject)
    server.once('listening', () => {
      const address = server.address()

      if (address === null || typeof address === 'string') {
        reject(new Error('expected the test server to report a network address'))
        return
      }

      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` })
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

interface JsonResponse {
  status: number
  body: any
}

async function getJson(baseUrl: string, path: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`)
  const body = await response.json()
  return { status: response.status, body }
}

describe('directory API (GET /api/contacts, GET /api/employees)', () => {
  let testEnvironment: TestEnvironment

  let appServer: Server
  let baseUrl: string

  let ContactModel: (typeof import('../modules/directory/contact.model.ts'))['ContactModel']
  let EmployeeModel: (typeof import('../modules/directory/employee.model.ts'))['EmployeeModel']

  before(async () => {
    // Per design.md D10: DB_HOST must point at the disposable in-memory
    // database before anything that reaches env.ts — including app.ts and
    // both directory models — is imported.
    testEnvironment = await startTestEnvironment()

    const { connectToMongo } = await import('../shared/infra/mongoose/client.ts')
    await connectToMongo()

    ;({ ContactModel } = await import('../modules/directory/contact.model.ts'))
    ;({ EmployeeModel } = await import('../modules/directory/employee.model.ts'))

    const { createApp } = await import('../app.ts')
    ;({ server: appServer, baseUrl } = await listen(createApp()))
  })

  after(async () => {
    await closeServer(appServer)
    await stopTestEnvironment(testEnvironment)
  })

  // Every scenario below starts from an empty directory so counts, order,
  // and exact-shape assertions never depend on another test's fixtures.
  beforeEach(async () => {
    await Promise.all([ContactModel.deleteMany({}), EmployeeModel.deleteMany({})])
  })

  let uniqueSeq = 0
  function nextSeq(): number {
    uniqueSeq += 1
    return uniqueSeq
  }

  interface ContactOverrides {
    firstName?: string
    lastName?: string
    email?: string
    status?: 'active' | 'inactive'
  }

  interface EmployeeOverrides extends ContactOverrides {
    position?: string
    department?: string
    canHostEvents?: boolean
  }

  function insertContact(overrides: ContactOverrides = {}) {
    const seq = nextSeq()
    return ContactModel.create({
      firstName: overrides.firstName ?? `First${seq}`,
      lastName: overrides.lastName ?? `Last${seq}`,
      email: overrides.email ?? `contact${seq}@example.test`,
      status: overrides.status ?? 'active',
    })
  }

  function insertEmployee(overrides: EmployeeOverrides = {}) {
    const seq = nextSeq()
    return EmployeeModel.create({
      firstName: overrides.firstName ?? `First${seq}`,
      lastName: overrides.lastName ?? `Last${seq}`,
      email: overrides.email ?? `employee${seq}@example.test`,
      status: overrides.status ?? 'active',
      position: overrides.position ?? 'Tester',
      department: overrides.department ?? 'QA',
      canHostEvents: overrides.canHostEvents ?? false,
    })
  }

  it('GET /api/contacts returns the named wrapper with only the declared projection fields', async () => {
    const created = await insertContact({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
      status: 'active',
    })

    const { status, body } = await getJson(baseUrl, '/api/contacts')

    assert.equal(status, 200)
    assert.deepEqual(Object.keys(body), ['contacts'])
    assert.equal(body.contacts.length, 1)

    const [contact] = body.contacts
    assert.deepEqual(
      Object.keys(contact).sort(),
      ['id', 'firstName', 'lastName', 'fullName', 'email', 'status'].sort(),
    )
    assert.deepEqual(contact, {
      id: String(created._id),
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      email: 'ada@example.test',
      status: 'active',
    })
  })

  it('GET /api/employees returns the named wrapper with contact fields plus position, department, canHostEvents', async () => {
    const created = await insertEmployee({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.test',
      status: 'active',
      position: 'Instructor',
      department: 'Academics',
      canHostEvents: true,
    })

    const { status, body } = await getJson(baseUrl, '/api/employees')

    assert.equal(status, 200)
    assert.deepEqual(Object.keys(body), ['employees'])
    assert.equal(body.employees.length, 1)

    const [employee] = body.employees
    assert.deepEqual(
      Object.keys(employee).sort(),
      [
        'id',
        'firstName',
        'lastName',
        'fullName',
        'email',
        'status',
        'position',
        'department',
        'canHostEvents',
      ].sort(),
    )
    assert.deepEqual(employee, {
      id: String(created._id),
      firstName: 'Grace',
      lastName: 'Hopper',
      fullName: 'Grace Hopper',
      email: 'grace@example.test',
      status: 'active',
      position: 'Instructor',
      department: 'Academics',
      canHostEvents: true,
    })
  })

  it('defaults to returning only active contacts and employees when status is omitted', async () => {
    await insertContact({ status: 'active', firstName: 'Active', lastName: 'Contact' })
    await insertContact({ status: 'inactive', firstName: 'Inactive', lastName: 'Contact' })
    await insertEmployee({ status: 'active', firstName: 'Active', lastName: 'Employee' })
    await insertEmployee({ status: 'inactive', firstName: 'Inactive', lastName: 'Employee' })

    const contacts = await getJson(baseUrl, '/api/contacts')
    const employees = await getJson(baseUrl, '/api/employees')

    assert.deepEqual(
      contacts.body.contacts.map((contact: { status: string }) => contact.status),
      ['active'],
    )
    assert.deepEqual(
      employees.body.employees.map((employee: { status: string }) => employee.status),
      ['active'],
    )
  })

  it('returns only inactive people when status=inactive is requested explicitly', async () => {
    await insertContact({ status: 'active' })
    await insertContact({ status: 'inactive' })
    await insertEmployee({ status: 'active' })
    await insertEmployee({ status: 'inactive' })

    const contacts = await getJson(baseUrl, '/api/contacts?status=inactive')
    const employees = await getJson(baseUrl, '/api/employees?status=inactive')

    assert.deepEqual(
      contacts.body.contacts.map((contact: { status: string }) => contact.status),
      ['inactive'],
    )
    assert.deepEqual(
      employees.body.employees.map((employee: { status: string }) => employee.status),
      ['inactive'],
    )
  })

  it('rejects an unrecognized status value with VALIDATION_ERROR on both endpoints', async () => {
    const contacts = await getJson(baseUrl, '/api/contacts?status=pending')
    const employees = await getJson(baseUrl, '/api/employees?status=pending')

    assert.equal(contacts.status, 400)
    assert.equal(contacts.body.error.code, 'VALIDATION_ERROR')
    assert.equal(employees.status, 400)
    assert.equal(employees.body.error.code, 'VALIDATION_ERROR')
  })

  it('returns only eligible, active-by-default hosts when canHostEvents=true', async () => {
    await insertEmployee({
      firstName: 'Eligible',
      lastName: 'Active',
      canHostEvents: true,
      status: 'active',
    })
    await insertEmployee({
      firstName: 'Ineligible',
      lastName: 'Active',
      canHostEvents: false,
      status: 'active',
    })
    await insertEmployee({
      firstName: 'Eligible',
      lastName: 'Inactive',
      canHostEvents: true,
      status: 'inactive',
    })

    const { status, body } = await getJson(baseUrl, '/api/employees?canHostEvents=true')

    assert.equal(status, 200)
    assert.equal(body.employees.length, 1)
    assert.equal(body.employees[0].lastName, 'Active')
    assert.equal(body.employees[0].canHostEvents, true)
    assert.equal(body.employees[0].status, 'active')
  })

  it('returns both eligible and ineligible employees when canHostEvents is omitted', async () => {
    await insertEmployee({ canHostEvents: true, lastName: 'Eligible' })
    await insertEmployee({ canHostEvents: false, lastName: 'Ineligible' })

    const { body } = await getJson(baseUrl, '/api/employees')

    const flags = body.employees
      .map((employee: { canHostEvents: boolean }) => employee.canHostEvents)
      .sort()
    assert.deepEqual(flags, [false, true])
  })

  it('rejects canHostEvents on the contacts endpoint with VALIDATION_ERROR', async () => {
    const { status, body } = await getJson(baseUrl, '/api/contacts?canHostEvents=true')

    assert.equal(status, 400)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })

  it('search matches a literal substring of either the first or last name, case-insensitively', async () => {
    await insertContact({ firstName: 'Priya', lastName: 'Shah' })
    await insertContact({ firstName: 'Marcus', lastName: 'Priyanka' })
    await insertContact({ firstName: 'Someone', lastName: 'Else' })

    const { status, body } = await getJson(
      baseUrl,
      `/api/contacts?${new URLSearchParams({ search: 'PrIy' })}`,
    )

    assert.equal(status, 200)
    const names = body.contacts.map((contact: { fullName: string }) => contact.fullName).sort()
    assert.deepEqual(names, ['Marcus Priyanka', 'Priya Shah'])
  })

  it('treats the search text as a literal string rather than a regular expression', async () => {
    await insertContact({ firstName: 'A+B', lastName: 'Plus' })
    await insertContact({ firstName: 'AB', lastName: 'NoPlus' })

    // If "+" were interpreted as the regex quantifier "one or more of the
    // preceding character", the pattern "A+B" would also match "AB" — a
    // literal match must not.
    const matchResponse = await getJson(
      baseUrl,
      `/api/contacts?${new URLSearchParams({ search: 'A+B' })}`,
    )
    assert.equal(matchResponse.status, 200)
    assert.deepEqual(
      matchResponse.body.contacts.map((contact: { firstName: string }) => contact.firstName),
      ['A+B'],
    )

    // A string that would be invalid or dangerous as a live regex pattern
    // (unbalanced brackets, catastrophic-backtracking-prone constructs)
    // must not fail the request — it simply matches nothing.
    const noCrashResponse = await getJson(
      baseUrl,
      `/api/contacts?${new URLSearchParams({ search: '.*+?^${}()|[]\\' })}`,
    )
    assert.equal(noCrashResponse.status, 200)
    assert.deepEqual(noCrashResponse.body.contacts, [])
  })

  it('accepts a search term of exactly 100 characters and rejects one longer than 100', async () => {
    const exactly100 = 'a'.repeat(100)
    const over100 = 'a'.repeat(101)

    const okResponse = await getJson(
      baseUrl,
      `/api/contacts?${new URLSearchParams({ search: exactly100 })}`,
    )
    assert.equal(okResponse.status, 200)

    const rejectedResponse = await getJson(
      baseUrl,
      `/api/contacts?${new URLSearchParams({ search: over100 })}`,
    )
    assert.equal(rejectedResponse.status, 400)
    assert.equal(rejectedResponse.body.error.code, 'VALIDATION_ERROR')
  })

  it('returns the same people in the same order for repeated identical requests', async () => {
    await insertContact({ firstName: 'Bob', lastName: 'Alpha' })
    await insertContact({ firstName: 'Ann', lastName: 'Beta' })
    await insertContact({ firstName: 'Cid', lastName: 'Alpha' })

    const first = await getJson(baseUrl, '/api/contacts')
    const second = await getJson(baseUrl, '/api/contacts')

    assert.equal(first.body.contacts.length, 3)
    assert.deepEqual(first.body, second.body)
  })

  it('breaks a lastName/firstName tie deterministically by id', async () => {
    const first = await insertContact({ firstName: 'Sam', lastName: 'Rivera' })
    const second = await insertContact({ firstName: 'Sam', lastName: 'Rivera' })

    const { body } = await getJson(baseUrl, '/api/contacts')

    const expectedIdOrder = [String(first._id), String(second._id)].sort()
    assert.deepEqual(
      body.contacts.map((contact: { id: string }) => contact.id),
      expectedIdOrder,
    )
  })

  it('caps results at 50 and returns exactly the first 50 in the declared order when more match', async () => {
    const created: Array<{ _id: unknown; firstName: string; lastName: string }> = []

    for (let index = 0; index < 55; index += 1) {
      const padded = String(index).padStart(2, '0')
      created.push(
        await insertContact({
          firstName: `First${padded}`,
          lastName: `Last${padded}`,
        }),
      )
    }

    const { status, body } = await getJson(baseUrl, '/api/contacts')

    assert.equal(status, 200)
    assert.equal(body.contacts.length, 50)

    const expectedOrder = [...created]
      .sort((a, b) => {
        if (a.lastName !== b.lastName) return a.lastName < b.lastName ? -1 : 1
        if (a.firstName !== b.firstName) return a.firstName < b.firstName ? -1 : 1
        const aId = String(a._id)
        const bId = String(b._id)
        return aId < bId ? -1 : aId > bId ? 1 : 0
      })
      .slice(0, 50)
      .map((contact) => String(contact._id))

    assert.deepEqual(
      body.contacts.map((contact: { id: string }) => contact.id),
      expectedOrder,
    )
  })

  it('rejects an undeclared result-size query parameter such as size or limit', async () => {
    const sizeResponse = await getJson(baseUrl, '/api/contacts?size=10')
    const limitResponse = await getJson(baseUrl, '/api/employees?limit=5')

    assert.equal(sizeResponse.status, 400)
    assert.equal(sizeResponse.body.error.code, 'VALIDATION_ERROR')
    assert.equal(limitResponse.status, 400)
    assert.equal(limitResponse.body.error.code, 'VALIDATION_ERROR')
  })

  it('returns 404 NOT_FOUND for write attempts against a directory route and never mutates data', async () => {
    const existing = await insertContact({ firstName: 'Untouched', lastName: 'Person' })

    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      for (const path of ['/api/contacts', '/api/employees']) {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { 'content-type': 'application/json' },
          body: method === 'DELETE' ? undefined : JSON.stringify({ firstName: 'Hacker' }),
        })
        const body = (await response.json()) as { error: { code: string } }

        assert.equal(response.status, 404, `expected 404 for ${method} ${path}`)
        assert.equal(body.error.code, 'NOT_FOUND')
      }
    }

    const contactCount = await ContactModel.countDocuments()
    assert.equal(contactCount, 1)

    const stillThere = await ContactModel.findById(existing._id).lean()
    assert.ok(stillThere, 'expected the pre-existing contact to remain untouched')
    assert.equal(stillThere?.firstName, 'Untouched')

    const employeeCount = await EmployeeModel.countDocuments()
    assert.equal(employeeCount, 0)
  })
})
