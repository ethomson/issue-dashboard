#!/usr/bin/env bash

escape_data() {
    local result=$1
    result="${result//'%'/%25}"
    result="${result//$'\n'/%0A}"
    result="${result//$'\r'/%0D}"
    echo "${result}"
}

set_output() {
    local data=$(escape_data "$2")
    echo "::set-output name=$1::$data"
}
