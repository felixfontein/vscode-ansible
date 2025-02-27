import * as vscode from "vscode";

export function adjustInlineSuggestionIndent(
  suggestion: string,
  position: vscode.Position
): string {
  const lines = suggestion.split("\n");
  const editor = vscode.window.activeTextEditor;
  const cursorLine = editor?.document.lineAt(position);
  const spacesBeforeCursor =
    cursorLine?.text.slice(0, position.character).match(/^ +/)?.[0].length || 0;

  let newSuggestion = suggestion;
  // adjust the spaces in suggestion line with respect to cursor position
  if (spacesBeforeCursor > 0 && lines.length > 0) {
    newSuggestion = lines
      .map((line, index) => {
        // BOUNDARY: shouldn't extend into the string
        if (line[position.character - 1]?.match(/\w/)) {
          console.error(`ignoring malformed line, indentation: '${line}'`);
          return "";
        }

        const newLine = line.substring(position.character);
        if (index === 0) {
          return newLine;
        } else {
          return " ".repeat(spacesBeforeCursor) + newLine;
        }
      })
      .filter((s) => s)
      .join("\n");
  }
  return newSuggestion;
}

/* A utility function to convert plain text to snippet string */
export function convertToSnippetString(suggestion: string): string {
  // this regex matches the content inside {{  }} with decided vars, i.e., {{ _var_ }}
  // TODO: once a prefix is decided for using it in from of variable names, the regex
  // can be changed to match it
  const regex = /(?:^|)[^@#\s_]*(_([^_]+)_)/gm;

  let counter = 0;
  const convertedSuggestion = suggestion.replace(regex, (item) => {
    counter = counter + 1;
    return `\${${counter}:${item}}`;
  });

  return convertedSuggestion;
}
