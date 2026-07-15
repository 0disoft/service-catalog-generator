import {
  cliCommandDefinitions,
  cliFlagDefinitions,
  completionShells,
  type CompletionShell
} from "./command-metadata.js";

export function isCompletionShell(value: string): value is CompletionShell {
  return completionShells.some((shell) => shell === value);
}

export function renderCompletion(shell: CompletionShell): string {
  switch (shell) {
    case "bash":
      return renderBashCompletion();
    case "zsh":
      return renderZshCompletion();
    case "powershell":
      return renderPowerShellCompletion();
  }
}

function renderBashCompletion(): string {
  const commands = cliCommandDefinitions.map((command) => command.name).join(" ");
  const flags = cliFlagDefinitions.map((flag) => flag.name).join(" ");
  const choiceCases = cliFlagDefinitions
    .filter((flag) => "choices" in flag)
    .map(
      (flag) =>
        `    ${flag.name}) COMPREPLY=( $(compgen -W "${flag.choices.join(" ")}" -- "$current") ); return ;;`
    )
    .join("\n");

  return `# bash completion for scg
_scg_completion() {
  local current previous
  current="\${COMP_WORDS[COMP_CWORD]}"
  previous="\${COMP_WORDS[COMP_CWORD-1]}"

  case "$previous" in
${choiceCases}
  esac

  if [[ "$COMP_CWORD" -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${commands} ${flags}" -- "$current") )
  elif [[ "\${COMP_WORDS[1]}" == "completion" ]]; then
    COMPREPLY=( $(compgen -W "${completionShells.join(" ")}" -- "$current") )
  else
    COMPREPLY=( $(compgen -W "${flags}" -- "$current") )
  fi
}
complete -F _scg_completion scg`;
}

function renderZshCompletion(): string {
  const commands = cliCommandDefinitions
    .map((command) => `    '${command.name}:${escapeSingleQuotes(command.description)}'`)
    .join("\n");
  const flags = cliFlagDefinitions
    .map((flag) => `    '${flag.name}:${escapeSingleQuotes(flag.description)}'`)
    .join("\n");
  const choiceCases = cliFlagDefinitions
    .filter((flag) => "choices" in flag)
    .map((flag) => `    ${flag.name}) _values '${flag.name}' ${flag.choices.join(" ")} ;;`)
    .join("\n");

  return `#compdef scg
_scg() {
  local -a commands flags
  commands=(
${commands}
  )
  flags=(
${flags}
  )

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    _describe 'flag' flags
    return
  fi

  if [[ "$words[2]" == "completion" ]]; then
    _values 'shell' ${completionShells.join(" ")}
    return
  fi

  case "$words[CURRENT-1]" in
${choiceCases}
  esac
  _describe 'flag' flags
}
compdef _scg scg`;
}

function renderPowerShellCompletion(): string {
  const commands = toPowerShellArray(cliCommandDefinitions.map((command) => command.name));
  const flags = toPowerShellArray(cliFlagDefinitions.map((flag) => flag.name));
  const shells = toPowerShellArray([...completionShells]);
  const choiceCases = cliFlagDefinitions
    .filter((flag) => "choices" in flag)
    .map((flag) => `      '${flag.name}' { $candidates = ${toPowerShellArray([...flag.choices])} }`)
    .join("\n");

  return `# PowerShell completion for scg
Register-ArgumentCompleter -Native -CommandName scg -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $elements = @($commandAst.CommandElements | ForEach-Object { $_.Extent.Text })
  $commands = ${commands}
  $flags = ${flags}
  $candidates = $flags

  if ($elements.Count -le 2) {
    $candidates = $commands + $flags
  } elseif ($elements[1] -eq 'completion') {
    $candidates = ${shells}
  } else {
    switch ($elements[$elements.Count - 2]) {
${choiceCases}
    }
  }

  $candidates |
    Where-Object { $_ -like "$wordToComplete*" } |
    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}`;
}

function toPowerShellArray(values: string[]): string {
  return `@(${values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")})`;
}

function escapeSingleQuotes(value: string): string {
  return value.replaceAll("'", "'\\''");
}
