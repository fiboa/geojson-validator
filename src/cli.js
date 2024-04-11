const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { validateFromConfig } = require('./validate.js');
const { createSchemaFromConfig } = require('./create_schema.js');
const { FIBOA_SPEC_VERSION } = require('./version.js');
const { version } = require('../package.json');

const fs = require('fs');

function runCLI() {
  yargs(hideBin(process.argv))
    .parserConfiguration({
      'boolean-negation': false,
      'strip-aliased': true
    })
    .command(
      'validate',
      'Validates GeoJSON files against the fiboa specification',
      yargs => yargs
        .option('schema', {
          alias: 's',
          type: 'string',
          default: null,
          description: 'fiboa Schema to validate against. Can be a local file or a URL. If not provided, uses the fiboa version to load the schema for the released version.'
        })
        .option('verbose', {
          alias: 'v',
          type: 'boolean',
          default: false,
          description: 'Run with verbose logging.'
        })
        .option('fiboa-version', {
          alias: 'f',
          type: 'string',
          default: FIBOA_SPEC_VERSION,
          description: `The fiboa version to validate against. Default is the version given in the collection, or ${FIBOA_SPEC_VERSION} if no collection is specified.`
        })
        .option('collection', {
          alias: 'c',
          type: 'string',
          default: null,
          description: 'Points to the STAC collection that defines the fiboa version and extensions.'
        })
        .option('ext-schema', {
          alias: 'e',
          type: 'array',
          default: [],
          description: 'Maps a remote fiboa extension schema url to a local file. First the URL, then the local file path. Separated with a comma character. Example: https://example.com/schema.json,/path/to/schema.json'
        }),
      async (config) => {
        console.log(`fiboa GeoJSON Validator ${version}`);
        console.log();
        try {
          config.files = config._.slice(1); // Remove the command "validate" from the files list
          const { invalid } = await validateFromConfig(config);
          console.log();
          if (invalid === 0) {
            console.log('=== All features are VALID ===');
          }
          else if (invalid === 1) {
            console.log(`=== 1 feature is INVALID ===`);
          }
          else {
            console.log(`=== ${invalid} features are INVALID ===`);
          }
          process.exit(0);
        } catch (error) {
          console.log(error);
          process.exit(1);
        }
      }
    )
    .command(
      'create-schema',
      'Create a JSON Schema for a fiboa Schema',
      yargs => yargs
        .option('schema', {
          alias: 's',
          type: 'string',
          default: null,
          description: 'fiboa Schema to create the JSON Schema for. Can be a local file or a URL. If not provided, uses the fiboa version to load the schema for the released version.'
        })
        .option('out', {
          alias: 'o',
          type: 'string',
          default: null,
          description: 'File to write the schema to. If not provided, prints the schema to the STDOUT.'
        })
        .option('fiboa-version', {
          alias: 'f',
          type: 'string',
          default: FIBOA_SPEC_VERSION,
          description: `The fiboa version to work against. Default is ${FIBOA_SPEC_VERSION}.`
        })
        .option('id', {
          type: 'string',
          default: null,
          description: 'The JSON Schema $id to use for the schema. If not provided, the $id will be omitted.'
        }),
      async (config) => {
        const schema = await createSchemaFromConfig(config);
        if (config.out) {
          fs.writeFileSync(config.out, JSON.stringify(schema, null, 2));
        }
        else {
          console.log(schema);
        }
      }
    )
    .help()
    .version()
    .parse();
}

module.exports = runCLI;