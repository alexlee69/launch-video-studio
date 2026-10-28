#!/bin/bash
curl -s -X POST http://127.0.0.1:19970/__mode -d "$1"; echo
