import { before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.DB_HOST = 'mongodb://127.0.0.1:27017/users-model-test'
process.env.DEFAULT_PHONE_REGION = 'UA'

type UsersModule = typeof import('../modules/users/user.model.ts')
type NormalizationModule = typeof import(
  '../modules/users/user-normalization.ts'
)

describe('user model and normalization', () => {
  let UserModel: UsersModule['UserModel']
  let normalizeUserPatch: NormalizationModule['normalizeUserPatch']

  const current = {
    firstName: 'Existing',
    lastName: 'User',
    email: 'existing@example.com',
    phone: null,
    phoneExtension: null,
    address: null,
    status: 'active' as const,
    lastLoginAt: null,
  }

  before(async () => {
    ;({ UserModel } = await import('../modules/users/user.model.ts'))
    ;({ normalizeUserPatch } = await import(
      '../modules/users/user-normalization.ts'
    ))
  })

  it('normalizes domain text to trimmed NFC and folds Cyrillic and diacritics', () => {
    const normalized = normalizeUserPatch(
      {
        firstName: '  МАРІЯ  ',
        lastName: ' S\u0061\u0301nchez ',
        email: '  Maria@Example.COM ',
      },
      current,
    )

    assert.equal(normalized.firstName, 'МАРІЯ')
    assert.equal(normalized.lastName, 'Sánchez')
    assert.equal(normalized.email, 'Maria@Example.COM')
    assert.equal(normalized.emailNormalized, 'maria@example.com')
    assert.equal(normalized.firstNameFolded, 'марія')
    assert.equal(normalized.lastNameFolded, 'sanchez')
    assert.equal(normalized.fullNameFolded, 'марія sanchez')
    assert.equal(normalized.fullNameReversedFolded, 'sanchez марія')
  })

  it('normalizes international and national phone formats to the same values', () => {
    const formats = [
      '+38 (050) 123-45-67',
      '050 123 45 67',
      '0501234567',
    ]

    const results = formats.map((phone) =>
      normalizeUserPatch({ phone }, current),
    )

    for (const result of results) {
      assert.equal(result.phone, '+380501234567')
      assert.equal(result.phoneDigits, '380501234567')
    }
  })

  it('keeps the phone extension separate from the E.164 phone', () => {
    const normalized = normalizeUserPatch(
      { phone: '+380501234567', phoneExtension: ' 42 ' },
      current,
    )

    assert.equal(normalized.phone, '+380501234567')
    assert.equal(normalized.phoneExtension, '42')
    assert.ok(!normalized.phone.includes('42'))
  })

  it('derives every status rank and ranks a null last login last', () => {
    assert.equal(
      normalizeUserPatch({ status: 'active' }, current).statusRank,
      0,
    )
    assert.equal(
      normalizeUserPatch({ status: 'inactive' }, current).statusRank,
      1,
    )
    assert.equal(
      normalizeUserPatch({ status: 'blocked' }, current).statusRank,
      2,
    )
    assert.equal(normalizeUserPatch({}, current).lastLoginRank, 1)
    assert.equal(
      normalizeUserPatch({}, { ...current, lastLoginAt: new Date() })
        .lastLoginRank,
      0,
    )
  })

  it('declares the required unique, ordering, and prefix-search indexes', () => {
    const indexes = UserModel.schema.indexes()

    assert.equal(UserModel.schema.get('autoIndex'), false)

    assert.ok(
      indexes.some(
        ([keys, options]) =>
          JSON.stringify(keys) === JSON.stringify({ emailNormalized: 1 }) &&
          options.unique === true &&
          options.collation === undefined &&
          options.partialFilterExpression === undefined,
      ),
    )
    assert.ok(
      indexes.some(
        ([keys, options]) =>
          JSON.stringify(keys) ===
            JSON.stringify({
              archivedAt: 1,
              lastName: 1,
              firstName: 1,
              _id: 1,
            }) &&
          options.collation?.locale === 'uk' &&
          options.collation.strength === 2,
      ),
    )

    const orderingIndexes = [
      {
        archivedAt: 1,
        lastName: 1,
        firstName: 1,
        _id: 1,
      },
      {
        archivedAt: 1,
        lastName: -1,
        firstName: -1,
        _id: 1,
      },
      {
        archivedAt: 1,
        firstName: 1,
        lastName: 1,
        _id: 1,
      },
      {
        archivedAt: 1,
        firstName: -1,
        lastName: -1,
        _id: 1,
      },
      { archivedAt: 1, statusRank: 1, _id: 1 },
      { archivedAt: 1, statusRank: -1, _id: 1 },
      {
        archivedAt: 1,
        lastLoginRank: 1,
        lastLoginAt: 1,
        _id: 1,
      },
      {
        archivedAt: 1,
        lastLoginRank: 1,
        lastLoginAt: -1,
        _id: 1,
      },
    ]

    for (const expected of orderingIndexes) {
      assert.ok(
        indexes.some(
          ([keys]) => JSON.stringify(keys) === JSON.stringify(expected),
        ),
        `missing ordering index ${JSON.stringify(expected)}`,
      )
    }

    for (const key of [
      'firstNameFolded',
      'lastNameFolded',
      'fullNameFolded',
      'fullNameReversedFolded',
      'emailNormalized',
      'phoneDigits',
    ]) {
      assert.ok(
        indexes.some(([keys]) => Object.hasOwn(keys, key)),
        `missing search index for ${key}`,
      )
    }
  })
})
