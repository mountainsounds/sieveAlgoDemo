
/**************************************************
************ Nav Menu ****************************
**************************************************/

const toggle = document.querySelector(".toggle");
const menu = document.querySelector(".menu");
const items = document.querySelectorAll(".item");

/* Toggle mobile menu */
function toggleMenu() {
  if (menu.classList.contains("active")) {
    menu.classList.remove("active");
    toggle.querySelector("a").innerHTML = "<i class='fas fa-bars'></i>";
  } else {
    menu.classList.add("active");
    toggle.querySelector("a").innerHTML = "<i class='fas fa-times'></i>";
  }
}

/* Activate Submenu */
function toggleItem() {
  if (this.classList.contains("submenu-active")) {
    this.classList.remove("submenu-active");
  } else if (menu.querySelector(".submenu-active")) {
    menu.querySelector(".submenu-active").classList.remove("submenu-active");
    this.classList.add("submenu-active");
  } else {
    this.classList.add("submenu-active");
  }
}

/* Close Submenu From Anywhere */
function closeSubmenu(e) {
  let isClickInside = menu.contains(e.target);

  if (!isClickInside && menu.querySelector(".submenu-active")) {
    menu.querySelector(".submenu-active").classList.remove("submenu-active");
  }
}
/* Event Listeners */
toggle.addEventListener("click", toggleMenu, false);
for (let item of items) {
  if (item.querySelector(".submenu")) {
    item.addEventListener("click", toggleItem, false);
  }
  item.addEventListener("keypress", toggleItem, false);
}
document.addEventListener("click", closeSubmenu, false);

/**************************************************
************ Code Demo ****************************
**************************************************/
let demoBtn = document.querySelector('#demoBtn');
let codeContainer = document.getElementById('codeContainer');
let squareWrapper = document.getElementById('squareWrapper');
let counter = document.getElementById('counter');
let numInput = document.getElementById('numInput');
let n = '';
let i = 0;

demoBtn.addEventListener('click', btnControl);

function btnControl(e) {
  e.preventDefault();
  n = numInput.value;

  if (!isValid(n)) {
   return;
 };

  if (i === 5) {
    reset();
    return;
  }

  if (i === 0) {
    buildSquareArr(numInput.value);
    e.currentTarget.textContent = 'NEXT';
  }

  if (i === 1) {
    document.getElementById('0').classList.add('squareFalsey');
    document.getElementById('1').classList.add('squareFalsey');
  }

  if (i === 3) markSquaresFalse(n);
  if (i === 4) countPrimes(n);

  codeContainer.innerHTML = elementArr[i];
  Prism.highlightAll();
  i++;

  if (i === 5) demoBtn.textContent = 'RESET';

}

function isValid(input) {
  if (!input || input.includes('e')) {
    demoBtn.textContent = 'ENTER NUMBER';
    setTimeout(() => {
      demoBtn.textContent = 'INITIATE'
    }, 400);
    numInput.value = '';
    return false
  }

  if (+input < 2 || +input > 200) {
    demoBtn.textContent = 'Pick a number between 2 - 200';
    setTimeout(() => {
      demoBtn.textContent = 'INITIATE'
    }, 1500);
    numInput.value = '';
    return false
  }

  return true;
}

function buildSquareArr (n) {
  counter.classList.add('countDiv');
  counter.textContent = 'Count: 0';
  for (let i = 0; i < n; i++) {
    let square = `<div class="square" id=${i}>${i}</div>`;
    squareWrapper.insertAdjacentHTML('beforeend', square);
  }

}

async function markSquaresFalse(n) {
  n = +n;

  for (let i = 2; i * i < n; i++) {
    let squareI = document.getElementById(`${i}`);
    squareI.classList.add('highlight');
    if (!squareI.classList.contains('squareFalsey')) {
      for (let j = 2; i * j < n; j++) {
       await sleep(250);
       let squareIxJ = document.getElementById(`${i * j}`);
        squareIxJ.classList.add('squareFalsey');
      }
    }
    squareI.classList.remove('highlight');
  }
}

async function countPrimes(n) {
  n = +n;
  let count = 0;

  for (let i = 2; i < n; i++) {
    let squareI = document.getElementById(`${i}`);
    squareI.classList.add('highlight');
    if (!squareI.classList.contains('squareFalsey')) {
      await sleep(400);
      count++;
      counter.textContent = `Count: ${count}`;
    }
    squareI.classList.remove('highlight');
  }
}

 function sleep(ms) {
   return new Promise(resolve => setTimeout(resolve, ms))
 }

function reset() {
  counter.classList.remove('countDiv');
  counter.textContent = '';
  numInput.value = '';
  demoBtn.textContent = 'INITIALIZE';
  i = 0;
  squareWrapper.innerHTML = '';
  codeContainer.innerHTML = initialState;
  Prism.highlightAll();
}