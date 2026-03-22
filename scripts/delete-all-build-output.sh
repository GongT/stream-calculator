#!/bin/bash

find -name lib -type d | grep -vF node_modules | xargs rm -rf
