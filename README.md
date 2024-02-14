# fiboa GeoJSON Validator

Validator for the fiboa GeoJSON encoding.

## Installation

You need node and npm installed. 
Run `npm install -g @fiboa/geojson-validator` to install the validator.

## Validation

To validate a fiboa GeoJSON file, you can for example run:

`fiboa-geojson-validator validate example.json --collection collection.json`

## Create JSON Schema

To create a JSON Schema for a fiboa Schema YAML file, you can for example run:

`fiboa-geojson-validator create-schema --id=https://fiboa.github.io/specification/v0.0.1/geojson/schema.json -o schema.json`

## Development

In a development environment use `npm run validator --` instead of `fiboa-geojson-validator`.
