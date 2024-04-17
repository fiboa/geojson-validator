# fiboa GeoJSON Validator

In order to make working with fiboa easier we have developed a GeoJSON validation tool. To get started with the fiboa GeoJSON Validator please follow the instructions below.


## Installation

You need node and npm installed. 
Run `npm install -g @fiboa/geojson-validator` to install the validator.

## Validation

To validate a fiboa GeoJSON file, you can for example run:

`fiboa-geojson-validator validate example.json --collection collection.json`

Check `fiboa-geojson-validator validate --help` for more details.

## Create JSON Schema

To create a JSON Schema for a fiboa Schema YAML file, you can for example run:

`fiboa-geojson-validator create-schema --id=https://fiboa.github.io/specification/v0.0.2/geojson/schema.json -o schema.json`

Check `fiboa-geojson-validator create-schema --help` for more details.

## Development

In a development environment use:
- `npm run create-schema --` instead of `fiboa-geojson-validator create-schema`
- `npm run validate --` instead of `fiboa-geojson-validator validate`
