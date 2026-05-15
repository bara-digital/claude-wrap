export function generateCompletion(shell: string): string {
  switch (shell) {
    case "zsh":
      return zshCompletion();
    case "bash":
      return bashCompletion();
    case "fish":
      return fishCompletion();
    default:
      return `${shell} not supported. Use: zsh, bash, or fish\n`;
  }
}

function extractPresetsCmd(): string {
  // awk-based YAML extraction — portable across macOS/Linux sed differences
  return `awk '/^presets:/{found=1;next} found && /^[^ ]/{exit} found && /^  [a-zA-Z0-9_-]+:/{gsub(/:/, ""); print $1}' "$HOME/.config/claude-wrap/presets.yaml" 2>/dev/null; [ -f ".claude-wrap.yaml" ] && awk '/^presets:/{found=1;next} found && /^[^ ]/{exit} found && /^  [a-zA-Z0-9_-]+:/{gsub(/:/, ""); print $1}' ".claude-wrap.yaml" 2>/dev/null`;
}

function zshCompletion(): string {
  return `#compdef claude-wrap

_claude_wrap() {
  local presets
  presets=(\${(f)"$(${extractPresetsCmd()})"})

  _arguments -s \\
    '--preset[use named preset]:preset:(\$presets)' \\
    '-p[use named preset]:preset:(\$presets)' \\
    '--config[explicit config file path]:file:_files' \\
    '-c[explicit config file path]:file:_files' \\
    '--init[generate template config]' \\
    '--list[list all presets]' \\
    '-l[list all presets]' \\
    '--doctor[validate all presets]' \\
    '--update[check for and install updates]' \\
    '--pick[force interactive picker]' \\
    '--dry-run[print resolved env vars without launching]' \\
    '--version[show version]' \\
    '-v[show version]' \\
    '--help[show help]' \\
    '-h[show help]' \\
    '*::claude args:'
}

_claude_wrap "\$@"
`;
}

function bashCompletion(): string {
  return `_claude_wrap_completions() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [[ "\$prev" == "--preset" || "\$prev" == "-p" ]]; then
    local presets
    presets=\$(${extractPresetsCmd()})
    COMPREPLY=(\$(compgen -W "\$presets" -- "\$cur"))
    return
  fi

  if [[ "\$prev" == "--config" || "\$prev" == "-c" ]]; then
    COMPREPLY=(\$(compgen -f -- "\$cur"))
    return
  fi

  COMPREPLY=(\$(compgen -W "--preset -p --config -c --init --list -l --doctor --update --pick --dry-run --version -v --help -h" -- "\$cur"))
}

complete -F _claude_wrap_completions claude-wrap
`;
}

function fishCompletion(): string {
  return `# Fish completion for claude-wrap
# Install: cp this to ~/.config/fish/completions/claude-wrap.fish

function __claude_wrap_presets
  ${extractPresetsCmd()}
end

complete -c claude-wrap -f

complete -c claude-wrap -s p -l preset -d "Use named preset" -x -a "(__claude_wrap_presets)"
complete -c claude-wrap -s c -l config -d "Explicit config file path" -r -F
complete -c claude-wrap -l init -d "Generate template config"
complete -c claude-wrap -s l -l list -d "List all presets"
complete -c claude-wrap -l doctor -d "Validate all presets"
complete -c claude-wrap -l update -d "Check for and install updates"
complete -c claude-wrap -l pick -d "Force interactive picker"
complete -c claude-wrap -l dry-run -d "Print resolved env vars without launching"
complete -c claude-wrap -s v -l version -d "Show version"
complete -c claude-wrap -s h -l help -d "Show help"
`;
}
