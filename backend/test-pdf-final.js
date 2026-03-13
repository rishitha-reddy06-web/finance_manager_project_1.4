const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);
if (typeof pdf === 'function') {
    console.log('pdf is a function (SUCCESS)');
} else {
    console.log('pdf is NOT a function (FAILURE)');
}
