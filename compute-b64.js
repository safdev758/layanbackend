const items = ['🍎','🍌','🥛','🥚','🍗','🍞'];
items.forEach(e => console.log(e + ': ' + Buffer.from(e).toString('base64')));
