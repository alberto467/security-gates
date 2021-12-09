import { GateSmith, Gate } from '../src'

class Foo {
  property: number

  constructor(property: number) {
    this.property = property
  }
}

const foo = new Foo(42)

class Bar {
  property: number

  constructor(property: number) {
    this.property = property
  }
}

const bar = new Bar(32)

type Actions = 'read' | 'update' | 'create'
type Entities = 'Foo' | Foo | 'Bar' | Bar

const checkFuncTrue = jest.fn(async () => {
  return true
})

const checkFuncFalse = jest.fn(async () => {
  return false
})

let gate: Gate<Actions, Entities>

describe('Test GateSmith', () => {
  it('Should build gate', async () => {
    const gateSmith = new GateSmith<Actions, Entities>()

    gateSmith.can('read', 'Foo')
    gateSmith.can('update', Bar, checkFuncTrue)
    gateSmith.can('create', Foo, checkFuncFalse)

    gate = gateSmith.buildGate()
  })
})

describe('Test Gate', () => {
  it('Should allow allowed actions', async () => {
    expect(await gate.can('read', 'Foo')).toBe(true)
    expect(await gate.can('update', bar)).toBe(true)
    expect(checkFuncTrue).toBeCalledWith(bar)
  })

  it('Should disallow disallowed actions', async () => {
    expect(await gate.can('read', bar)).toBe(false)
    expect(await gate.can('update', 'Foo')).toBe(false)
    expect(await gate.can('create', foo)).toBe(false)
    expect(checkFuncFalse).toBeCalledWith(foo)
  })
})
