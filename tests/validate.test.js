const { validateFromConfig, setLogger } = require('../src/validate.js');

let messages;
let logger = msg => messages.push(msg);

describe('Validate fiboa data', () => {
  beforeEach(() => {
    messages = [];
    setLogger(logger);
  });
  
  test('example 1', async () => {
    const config = {
      files: [
        "tests/data-files/validate/example1.json"
      ]
    }
    const result = await validateFromConfig(config);
    expect(result.count).toBe(1);
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(0);
    expect(messages).toEqual([
      "=== tests/data-files/validate/example1.json ===",
      "fiboa version: 0.2.0",
      "fiboa extensions: https://fiboa.github.io/inspire-extension/v0.2.0/schema.yaml",
      "tests/data-files/validate/example1.json: VALID"
    ]);
  });
});
