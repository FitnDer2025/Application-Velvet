(() => {
  const SIZE = 33;
  const DATA_CODEWORDS = 80;
  const ECC_CODEWORDS = 20;

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i -= 1) {
      z = (z << 1) ^ (((z >>> 7) & 1) * 0x11d);
      if (((y >>> i) & 1) !== 0) z ^= x;
    }
    return z & 255;
  }

  function generator(degree) {
    let polynomial = [1];
    let root = 1;
    for (let i = 0; i < degree; i += 1) {
      const next = new Array(polynomial.length + 1).fill(0);
      for (let j = 0; j < polynomial.length; j += 1) {
        next[j] ^= polynomial[j];
        next[j + 1] ^= gfMul(polynomial[j], root);
      }
      polynomial = next;
      root = gfMul(root, 2);
    }
    return polynomial;
  }

  const ECC_GENERATOR = generator(ECC_CODEWORDS);

  function ecc(data) {
    const remainder = new Array(ECC_CODEWORDS).fill(0);
    for (const byte of data) {
      const factor = byte ^ remainder[0];
      remainder.shift();
      remainder.push(0);
      for (let index = 0; index < ECC_CODEWORDS; index += 1) {
        remainder[index] ^= gfMul(ECC_GENERATOR[index + 1], factor);
      }
    }
    return remainder;
  }

  function appendBits(target, value, length) {
    for (let i = length - 1; i >= 0; i -= 1) target.push((value >>> i) & 1);
  }

  function codewords(text) {
    const bytes = [...new TextEncoder().encode(text)];
    if (bytes.length > 78) throw new Error('qr_payload_too_long');
    const bits = [];
    appendBits(bits, 0x4, 4);
    appendBits(bits, bytes.length, 8);
    bytes.forEach((byte) => appendBits(bits, byte, 8));
    for (let i = 0; i < Math.min(4, DATA_CODEWORDS * 8 - bits.length); i += 1) bits.push(0);
    while (bits.length % 8) bits.push(0);

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }
    for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);
    return data.concat(ecc(data));
  }

  function matrix(text) {
    const payload = codewords(text);
    const bits = [];
    payload.forEach((byte) => appendBits(bits, byte, 8));

    const modules = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const functionModules = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const setFunction = (x, y, value) => {
      if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
      modules[y][x] = Boolean(value);
      functionModules[y][x] = true;
    };

    function finder(left, top) {
      for (let dy = -1; dy <= 7; dy += 1) {
        for (let dx = -1; dx <= 7; dx += 1) {
          const black = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6
            && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
          setFunction(left + dx, top + dy, black);
        }
      }
    }

    finder(0, 0);
    finder(SIZE - 7, 0);
    finder(0, SIZE - 7);

    for (let i = 8; i < SIZE - 8; i += 1) {
      if (!functionModules[6][i]) setFunction(i, 6, i % 2 === 0);
      if (!functionModules[i][6]) setFunction(6, i, i % 2 === 0);
    }

    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunction(26 + dx, 26 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }

    // Error correction L + mask 0. A fixed valid mask keeps this runtime tiny,
    // deterministic and independent from third-party QR services.
    const mask = 0;
    const formatData = (1 << 3) | mask;
    let remainder = formatData;
    for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
    const format = ((formatData << 10) | remainder) ^ 0x5412;
    const formatBit = (index) => ((format >>> index) & 1) !== 0;
    for (let i = 0; i <= 5; i += 1) setFunction(8, i, formatBit(i));
    setFunction(8, 7, formatBit(6));
    setFunction(8, 8, formatBit(7));
    setFunction(7, 8, formatBit(8));
    for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, formatBit(i));
    for (let i = 0; i < 8; i += 1) setFunction(SIZE - 1 - i, 8, formatBit(i));
    for (let i = 8; i < 15; i += 1) setFunction(8, SIZE - 15 + i, formatBit(i));
    setFunction(8, SIZE - 8, true);

    let bitIndex = 0;
    for (let right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < SIZE; vertical += 1) {
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? SIZE - 1 - vertical : vertical;
        for (let column = 0; column < 2; column += 1) {
          const x = right - column;
          if (functionModules[y][x]) continue;
          let value = bitIndex < bits.length ? bits[bitIndex] : 0;
          bitIndex += 1;
          if ((x + y) % 2 === 0) value ^= 1;
          modules[y][x] = Boolean(value);
        }
      }
    }
    return modules;
  }

  function svg(text, { border = 4 } = {}) {
    const modules = matrix(text);
    let path = '';
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (modules[y][x]) path += `M${x + border},${y + border}h1v1h-1z`;
      }
    }
    const dimension = SIZE + border * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges"><rect width="100%" height="100%" rx="3" fill="#fff"/><path d="${path}" fill="#09090b"/></svg>`;
  }

  function dataUrl(text) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(text))}`;
  }

  window.ZwitQRV4 = Object.freeze({ matrix, svg, dataUrl });
})();
