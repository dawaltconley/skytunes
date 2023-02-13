/**
 * An abstraction class to handle items with expensive syncronous calculations.
 * Its value is only recalculated after it has been manually cleared, or when
 * any items it depends on have been cleared.
 */
class CacheItem<Value = any> {
  #value: Value | null = null
  #recalculate: () => Value
  dependencies: CacheItem[]
  dependents: CacheItem[] = []

  /**
   * @param calculate - a function that returns a new value whenever a cached
   * item needs to be recalculated.
   * @param dependencies - a list of CacheItems that this depends on. this
   * items cache will be cleared whenever any dependencies are updated.
   */
  // TODO pass dependencies as arguments to calculate function?
  constructor(
    calculate: (...args: any[]) => Value,
    dependencies: CacheItem[] = []
  ) {
    this.#recalculate = () => {
      const args = dependencies.map(d => d.get())
      return calculate(...args)
    }
    this.dependencies = dependencies
    dependencies.forEach(dep => dep.dependents.push(this))
  }

  isCached(): boolean {
    return this.#value !== null
  }

  /** gets the cached value or recalculates it if needed */
  get(): Value {
    return this.#value ?? this.set(this.#recalculate())
  }

  /** sets the cached value and clears its dependents */
  set(v: Value): Value {
    if (v !== this.#value) this.clear()
    this.#value = v
    return v
  }

  // TODO instead of looping through dependents, might be better to loop dependencies
  // check whether each is valid (has a .isValid flag) and if any is invalid, invalidate this cache
  /** clears the cache of this item and all of its dependents */
  clear() {
    if (this.#value !== null) {
      this.dependents.forEach(dep => dep.clear())
      this.#value = null
    }
  }

  /** alias for CacheItem.get(), allows coercion */
  valueOf(): Value {
    return this.get()
  }
}

type Cached<T> = {
  [Property in keyof T]: CacheItem<T[Property]>
}

const getCacheLayer = <T>(cached: Cached<T>): T & { cache: Cached<T> } => {
  return new Proxy(cached, {
    get(target, p) {
      const value = Reflect.get(target, p)
      if (p === 'cache') {
        return target
      } else if (value instanceof CacheItem) {
        return value.get()
      }
      return value
    },
    set(target, p, value) {
      const obj = Reflect.get(target, p)
      if (obj instanceof CacheItem) {
        obj.set(value)
        return true
      }
      return Reflect.set(target, p, value)
    },
  }) as T & { cache: Cached<T> }
}

// abstract class CacheLayer2<T> {
//   [Prop in keyof T]: T[Prop]
// }

// class CacheLayer<T> {
//   // [Prop in keyof T]: string
//   readonly cache: Cached<T>
//   constructor(cacheObject: Cached<T>) {
//     this.cache = cacheObject
//
//     // let k: keyof T
//     // for (k in cacheObject) {
//     //   this[k] = cacheObject[k].get()
//     // }
//   }
// }

class CacheLayer {
  // readonly cache: Cached<any>
  // constructor(cacheObject: Cached<any>) {
  //   this.cache = cacheObject
  // }
}

interface Foo {
  foo: 'bar'
  bar: 5
}

// class FooLayer extends getClassFactory<Foo>({
//   foo: new CacheItem(() => 'bar'),
//   bar: new CacheItem(() => 5),
// }) {
//   constructor(foo: Cached<Foo>) {
//     return test(foo)
//   }
// }

type ExtendedProperties<T> = { [P in keyof T]: T[P] }
function MyClassFactory<T>(obj: Cached<T>): CacheLayer & ExtendedProperties<T> {
  return new CacheLayer(obj) as CacheLayer & ExtendedProperties<T>
}

let foo = MyClassFactory<Foo>({
  foo: new CacheItem(() => 'bar'),
  bar: new CacheItem(() => 5),
})

foo.cache.foo

// var ap = new FooLayer({
//   foo: new CacheItem(() => 'bar'),
//   bar: new CacheItem(() => 5)
// })

class Test {
  foo = new CacheItem(() => 'bar')
  bar = new CacheItem(() => 5)
}

let t = new Test()

// let access = test({
//   foo: 'bar',
//   bar: new CacheItem(() => 5),
// })
// access.bar

export { CacheItem, getCacheLayer }
export type { Cached }
