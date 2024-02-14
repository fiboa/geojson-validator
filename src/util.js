const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const YAML = require('yaml');

// Check if something is an object
function isObject(obj) {
	return (typeof obj === 'object' && obj === Object(obj) && !Array.isArray(obj));
}

// Check whether a URI is an HTTP(S) URL
function isHttp(uri) {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

// Expands folders to files
async function getFiles(files, extensions) {
  const allFiles = [];
  const addFile = async (file) => {
    if (extensions.includes(path.extname(file))) {
      allFiles.push(file);
    }
  };
  // Check for folders and expand the contents to a list of files
  for(const file of files) {
    if (isHttp(file)) {
      allFiles.push(file);
      continue;
    }
    const stat = await fs.lstat(file);
    if (stat.isDirectory()) {
      const folderFiles = await fs.readdir(file);
      for (const folderFile of folderFiles) {
        addFile(path.join(file, folderFile));
      }
    }
    else {
      addFile(file);
    }
  }
	return allFiles;
}

// Load schemas and data from filesystem or URL
async function loadFile(uri) {
  let parser;
  if (uri.endsWith(".yml") || uri.endsWith(".yaml")) {
    parser = YAML.parse;
  }
  else if (uri.endsWith(".json") || uri.endsWith(".geojson")) {
    parser = JSON.parse;
  }
  else {
    // Pass through
    parser = data => data;
  }
	if (isHttp(uri)) {
		let response = await axios.get(uri);
    if (typeof response.data === 'string') {
      return parser(response.data);
    }
    else {
		  return response.data;
    }
	}
	else {
		return parser(await fs.readFile(uri, "utf8"));
	}
}

async function loadDatatypes(version) {
  const dtSchemaUrl = `https://fiboa.github.io/specification/v${version}/geojson/datatypes.json`;
  const response = await loadFile(dtSchemaUrl);
  return await response.$defs;
}

async function loadSchema(config) {
  let schemaUrl = config.schema;
  if (!config.schema) {
    schemaUrl = `https://fiboa.github.io/specification/v${config.fiboaVersion}/schema.yml`
  }
  return await loadFile(schemaUrl);
}

module.exports = { getFiles, isObject, isHttp, loadDatatypes, loadFile, loadSchema };