// let a = Array.from({ length: 20 }, () => Math.floor(Math.random() * 20)).sort(
//   (a, b) => a - b
// )
// let n = Math.floor(Math.random() * 20)

type BinarySearch = (a: number[], target: number) => number
var binarySearch1: BinarySearch = (a, target) => {
  // binary search to find insertion point
  let left = 0
  let right = a.length - 1

  while (left <= right) {
    let i = Math.floor((right + 1 - left) / 2) + left
    if (right - left < 2) {
      // len 2 array, 3 possible insertion points
      if (target < a[left]) return left
      else if (target > a[right]) return right + 1
      return right
    }
    // using floats, not worried about equality ??
    if (a[i] < target) {
      // search right
      left = i + 1
    } else {
      // search left
      right = i - 1
    }
  }

  console.log('whoops', { left, right })
  return -1
}

var binarySearch2: BinarySearch = (a, target) => {
  // binary search to find insertion point
  let left = 0
  let right = a.length - 1

  while (true) {
    let i = (((right + 1 - left) / 2) >> 0) + left
    // let i = Math.ceil((right - left) / 2) + left
    // let len = right - left
    // let i = (len + (len % 2)) / 2 + left
    if (a[i] < target) {
      // search right
      if (right - left < 2) {
        return i + 1
      }
      left = i + 1
    } else {
      // search left
      if (right === left) {
        return i
      }
      right = i - 1
    }
  }
}

var validate: BinarySearch = (a, target) => {
  for (let i = 0; i < a.length; i++) {
    let n = a[i]
    let last = a[i - 1]
    if ((!last || last < target) && n >= target) {
      return i
    }
  }
  return a.length
}

var test = (binSearch: BinarySearch) => {
  let e = 0
  for (let i = 0; i < 1000; i++) {
    let a = Array.from({ length: 200 }, () => Math.random() * 200).sort(
      (a, b) => a - b
    )
    let n = Math.floor(Math.random() * 200)

    let binary = binSearch(a, n)
    let linear = validate(a, n)

    if (binary !== linear) {
      e++
      console.log('found mismatch')
      console.table({
        target: n,
        binary,
        linear,
        binaryValues: [a[binary - 1], a[binary]],
        linearValues: [a[linear - 1], a[linear]],
      })
    }
  }
  console.log(`${e} errors`)
  return e === 0 ? true : false
}

var timeTest = (binSearch: BinarySearch) => {
  console.time('large binary search')
  let a = Array.from({ length: 10000 }, () => Math.random() * 200).sort(
    (a, b) => a - b
  )
  for (let i = 0; i < 10000; i++) {
    let n = Math.floor(Math.random() * 200)
    binSearch(a, n)
  }
  console.timeEnd('large binary search')
}

// console.log('testing binarySearch1')
// test(binarySearch1) && timeTest(binarySearch1)

console.log('testing binarySearch2')
test(binarySearch2) && timeTest(binarySearch2)
