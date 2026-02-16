const _0x4d2e = (s, k = 42) => {
    const b = Buffer.from(s, 'base64').toString('utf-8');
    return b.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ k)).join('');
};

const _enc = (s, k = 42) => {
    const b = s.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ k)).join('');
    return Buffer.from(b).toString('base64');
};

module.exports = { _0x4d2e, _enc };
