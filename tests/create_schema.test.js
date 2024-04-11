const { FIBOA_SPEC_VERSION } = require('../src/version.js');
const { createSchemaFromConfig } = require('../src/create_schema.js');
const { loadFile } = require('../src/util.js');

describe('Create JSON Schema from fiboa Schema', () => {
  test('test 1', async () => {
    const config = {
      schema: "tests/data-files/create_schema/test1.yaml",
      fiboaVersion: FIBOA_SPEC_VERSION,
      id: "https://example.com/schema.json",
    }
    created_json_schema = await createSchemaFromConfig(config);
    expected_json_schema = await loadFile("tests/data-files/create_schema/test1.json");
    expect(created_json_schema).toEqual(expected_json_schema);
  });
});