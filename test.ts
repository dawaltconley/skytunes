let a = Array.from({ length: 20 }, () => Math.floor(Math.random() * 20)).sort(
  (a, b) => a - b
)
let n = Math.floor(Math.random() * 20)

var binarySearch = (n, arr) => {
  // binary search stars to find insertion point
  let len = arr.length
  let target = n
  let middle = Math.floor(len / 2)
  let insert = 0
  // let m1 = m2 - 1
  while (!insert && len > 1) {
    console.log(arr[middle - 1], arr[middle], middle - 1, middle, len)
    if (target > arr[middle]) {
      console.log('right search')
      len = len - middle + 2
      middle += Math.floor(len / 2)
    } else if (target < arr[middle - 1]) {
      console.log('left search')
      // handle search to the left
      len = middle // same as above?
      middle -= Math.floor(len / 2)
    } else {
      console.log('found targt')
      insert = middle - 1
    }
    // len /= 2
  }

  return insert
}
