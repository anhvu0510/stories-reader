const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        if (file === 'node_modules' || file === 'dist' || file.startsWith('.')) return;
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    const sizeMap = {
        '48': '36',
        '36': '28',
        '32': '24',
        '28': '24',
        '26': '22',
        '24': '20',
        '22': '18',
        '20': '18',
        '18': '16',
        '16': '14',
        '14': '12',
    };

    let modified = content.replace(/size=\{([0-9]+)\}/g, (match, sizeNum) => {
        if (sizeMap[sizeNum]) {
            return `size={${sizeMap[sizeNum]}}`;
        }
        return match;
    });

    if (modified !== original) {
        fs.writeFileSync(file, modified, 'utf8');
        console.log('Modified', file);
    }
});
