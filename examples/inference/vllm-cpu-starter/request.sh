#!/bin/sh
set -eu

response=$(kubectl exec -n inference deployment/chat -- request-model)
answer=$(printf '%s' "$response" | jq -r '.choices[0].message.content // empty')
model=$(printf '%s' "$response" | jq -r '.model // empty')

test -n "$answer"
test "$model" = "Qwen/Qwen2.5-0.5B-Instruct"

printf 'model: %s\nanswer: %s\n' "$model" "$answer"
