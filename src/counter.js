/**
 * Sets up a counter on a given element.
 * @param {HTMLElement} element - The element to attach the counter to.
 */
export function setupCounter(element) {
  let counter = 0
  /**
   * Updates the counter value and the element's inner HTML.
   * @param {number} count - The new counter value.
   */
  const setCounter = (count) => {
    counter = count
    element.innerHTML = `Count is ${counter}`
  }
  element.addEventListener('click', () => setCounter(counter + 1))
  setCounter(0)
}
