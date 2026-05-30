const a = require('./deploy-arguments-export.json');
const b = require('./deploy-arguments-supervisor.json');
console.log(
  JSON.stringify({
    export: {
      name: a.name,
      streams: a.files[0].content.includes('Streams an inspections CSV'),
      placeholder: /PLACEHOLDER/i.test(a.files[0].content),
    },
    supervisor: {
      name: b.name,
      send: b.files[0].content.includes("action: 'send'"),
      placeholder: /PLACEHOLDER/i.test(b.files[0].content),
    },
  }),
);
