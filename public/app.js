(function () {
  const display = document.getElementById('display');
  const keys = document.getElementById('keys');
  const scene = document.getElementById('scene');
  const calculator = document.getElementById('calculator');

  const calculatorState = {
    displayValue: '0',
    firstOperand: null,
    operator: null,
    waitingForSecondOperand: false,
  };

  function updateDisplay(value) {
    display.textContent = value;
  }

  function inputDigit(digit) {
    const { displayValue, waitingForSecondOperand } = calculatorState;
    if (waitingForSecondOperand) {
      calculatorState.displayValue = String(digit);
      calculatorState.waitingForSecondOperand = false;
    } else {
      calculatorState.displayValue = displayValue === '0' ? String(digit) : displayValue + String(digit);
    }
  }

  function inputDecimal() {
    if (calculatorState.waitingForSecondOperand) {
      calculatorState.displayValue = '0.';
      calculatorState.waitingForSecondOperand = false;
      return;
    }
    if (!calculatorState.displayValue.includes('.')) {
      calculatorState.displayValue += '.';
    }
  }

  function handleOperator(nextOperator) {
    const inputValue = parseFloat(calculatorState.displayValue);

    if (calculatorState.operator && calculatorState.waitingForSecondOperand) {
      calculatorState.operator = nextOperator;
      return;
    }

    if (calculatorState.firstOperand == null) {
      calculatorState.firstOperand = inputValue;
    } else if (calculatorState.operator) {
      const result = calculate(calculatorState.firstOperand, inputValue, calculatorState.operator);
      calculatorState.displayValue = String(result);
      calculatorState.firstOperand = result;
    }

    calculatorState.waitingForSecondOperand = true;
    calculatorState.operator = nextOperator;
  }

  function calculate(first, second, operator) {
    if (operator === '+') return round(first + second);
    if (operator === '-') return round(first - second);
    if (operator === '*') return round(first * second);
    if (operator === '/') return second === 0 ? '∞' : round(first / second);
    return second;
  }

  function round(value) {
    if (!isFinite(value)) return value;
    return Math.round((value + Number.EPSILON) * 1e12) / 1e12;
  }

  function clearAll() {
    calculatorState.displayValue = '0';
    calculatorState.firstOperand = null;
    calculatorState.operator = null;
    calculatorState.waitingForSecondOperand = false;
  }

  function toggleSign() {
    if (calculatorState.displayValue === '0') return;
    if (calculatorState.displayValue.startsWith('-')) {
      calculatorState.displayValue = calculatorState.displayValue.slice(1);
    } else {
      calculatorState.displayValue = '-' + calculatorState.displayValue;
    }
  }

  function percent() {
    const value = parseFloat(calculatorState.displayValue);
    calculatorState.displayValue = String(round(value / 100));
  }

  keys.addEventListener('click', (event) => {
    const target = event.target;
    if (!target.classList.contains('key')) return;

    const digit = target.getAttribute('data-digit');
    const action = target.getAttribute('data-action');

    if (digit !== null) {
      inputDigit(digit);
    } else if (action === 'decimal') {
      inputDecimal();
    } else if (action === 'clear') {
      clearAll();
    } else if (action === 'sign') {
      toggleSign();
    } else if (action === 'percent') {
      percent();
    } else if (action === 'operator') {
      const operator = target.getAttribute('data-operator');
      handleOperator(operator);
    } else if (action === 'equals') {
      if (calculatorState.operator != null) {
        const inputValue = parseFloat(calculatorState.displayValue);
        const result = calculate(calculatorState.firstOperand ?? 0, inputValue, calculatorState.operator);
        calculatorState.displayValue = String(result);
        calculatorState.firstOperand = null;
        calculatorState.operator = null;
        calculatorState.waitingForSecondOperand = false;
      }
    }

    updateDisplay(formatDisplay(calculatorState.displayValue));
    animatePress(target);
  });

  function animatePress(button) {
    button.animate([
      { transform: 'translateY(0) translateZ(0)' },
      { transform: 'translateY(2px) translateZ(2px)' },
      { transform: 'translateY(0) translateZ(0)' },
    ], { duration: 120, easing: 'ease-out' });
  }

  function formatDisplay(value) {
    if (value === '∞' || value === 'NaN') return value;
    const num = Number(value);
    if (!isFinite(num)) return String(value);
    const abs = Math.abs(num);
    if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
      return num.toExponential(6).replace(/\+?0*(?=e)/, '');
    }
    const str = String(round(num));
    if (str.includes('.')) {
      const [i, f] = str.split('.');
      const trimmed = f.replace(/0+$/, '');
      return trimmed.length ? `${i}.${trimmed}` : i;
    }
    return str;
  }

  // 3D tilt/parallax
  let tiltRAF = null;
  let currentRotX = 0;
  let currentRotY = 0;

  function setTilt(clientX, clientY) {
    const rect = scene.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;   // 0..1
    const relY = (clientY - rect.top) / rect.height;  // 0..1

    const maxDeg = 16; // max tilt
    const rotY = (relX - 0.5) * (maxDeg * 2); // left-right
    const rotX = (0.5 - relY) * (maxDeg * 2); // up-down

    currentRotX = rotX;
    currentRotY = rotY;

    if (!tiltRAF) {
      tiltRAF = requestAnimationFrame(() => {
        calculator.style.transform = `rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg)`;
        applyDepthParallax(currentRotX, currentRotY);
        tiltRAF = null;
      });
    }
  }

  function applyDepthParallax(rotX, rotY) {
    const depthEls = calculator.querySelectorAll('[data-depth]');
    depthEls.forEach((el) => {
      const depth = Number(el.getAttribute('data-depth')) || 0;
      const x = rotY / 16 * depth; // smaller parallax
      const y = -rotX / 16 * depth;
      el.style.transform = `translateZ(${depth}px) translate(${x}px, ${y}px)`;
    });
  }

  scene.addEventListener('mousemove', (e) => {
    setTilt(e.clientX, e.clientY);
  });

  scene.addEventListener('mouseleave', () => {
    calculator.style.transform = 'rotateX(0deg) rotateY(0deg)';
    const depthEls = calculator.querySelectorAll('[data-depth]');
    depthEls.forEach((el) => {
      const depth = Number(el.getAttribute('data-depth')) || 0;
      el.style.transform = `translateZ(${depth}px)`;
    });
  });

  // Keyboard support
  window.addEventListener('keydown', (e) => {
    const key = e.key;
    if (/^[0-9]$/.test(key)) {
      inputDigit(key);
    } else if (key === '.') {
      inputDecimal();
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
      handleOperator(key);
    } else if (key === 'Enter' || key === '=') {
      if (calculatorState.operator != null) {
        const inputValue = parseFloat(calculatorState.displayValue);
        const result = calculate(calculatorState.firstOperand ?? 0, inputValue, calculatorState.operator);
        calculatorState.displayValue = String(result);
        calculatorState.firstOperand = null;
        calculatorState.operator = null;
        calculatorState.waitingForSecondOperand = false;
      }
    } else if (key === 'Escape') {
      clearAll();
    } else if (key === '%') {
      percent();
    }
    updateDisplay(formatDisplay(calculatorState.displayValue));
  });

  // Initialize
  updateDisplay(formatDisplay(calculatorState.displayValue));
})();