import vscode from 'vscode';

const instructionRegex = /\b(add|sub|mul|div|and|or|xor|sll|srl|sra|slt|sltu|addi|xori|nop|beq|bne|blt|bge|bltu|bgeu|jal|jalr|lb|lh|lw|ld|lbu|lhu|lwu|sb|sh|sw|sd|fadd|fsub|fmul|fdiv|fsqrt|fcvt|feq|flt|fle|fclass|fmv|fmv.x|fmv.x.w|li|la|ebreak|ecall)\b/;
const labelRegex = /^[a-zA-Z_][a-zA-Z0-9_]*:$/;
const immediateRegex = /^[0-9]+$/;
const roundingModeRegex = /\b(rne|rtz|rdn|rup|rmm|dyn)\b/;
const gpregRegex = /\b(x[0-9]{1,2}|a[0-9]|s[0-9]|t[0-9]|ra|sp|gp|tp)\b/;
const fpregRegex = /\b(f[0-9]{1,2})\b/;
const csregRegex = /\b(fflags|frm|fcsr)\b/;

const directiveRegex = /^\.(section|data|text|bss|globl|byte|half|word|dword|float|double|string|zero)$/;



const arg_types = {
  'add': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'sub': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'and': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'xor': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'or': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'sll': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'srl': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'sra': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'slt': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'sltu': [['gpreg', ',', 'gpreg', ',', 'gpreg']],

  'addi': [['gpreg', ',', 'gpreg', ',', 'imm']],
  'andi': [['gpreg', ',', 'gpreg', ',', 'imm']],
  'xori': [['gpreg', ',', 'gpreg', ',', 'imm']],
  'ori': [['gpreg', ',', 'gpreg', ',', 'imm']],
  'slli': [['gpreg', ',', 'gpreg', ',', 'imm']],
  'srli': [['gpreg', ',', 'gpreg', ',', 'imm']],
  'srai': [['gpreg', ',', 'gpreg', ',', 'imm']],
  'slti': [['gpreg', ',', 'gpreg', ',', 'imm']],
  'sltiu': [['gpreg', ',', 'gpreg', ',', 'imm']],

  'lb': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'lh': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'lw': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'ld': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'lbu': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'lhu': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'lwu': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],

  'sb': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'sh': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'sw': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],
  'sd': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],


  'beq': [['gpreg', ',', 'gpreg', ',', 'label'], ['gpreg', ',', 'gpreg', ',', 'imm']],
  'bne': [['gpreg', ',', 'gpreg', ',', 'label'], ['gpreg', ',', 'gpreg', ',', 'imm']],
  'blt': [['gpreg', ',', 'gpreg', ',', 'label'], ['gpreg', ',', 'gpreg', ',', 'imm']],
  'bge': [['gpreg', ',', 'gpreg', ',', 'label'], ['gpreg', ',', 'gpreg', ',', 'imm']],
  'bltu': [['gpreg', ',', 'gpreg', ',', 'label'], ['gpreg', ',', 'gpreg', ',', 'imm']],
  'bgeu': [['gpreg', ',', 'gpreg', ',', 'label'], ['gpreg', ',', 'gpreg', ',', 'imm']],

  'lui': [['gpreg', ',', 'imm']],
  'auipc': [['gpreg', ',', 'imm']],

  'jal': [['gpreg', ',', 'label'], ['gpreg', ',', 'imm']],
  'jalr': [['gpreg', ',', 'imm', '(', 'gpreg', ')']],

  'ecall': [],
  'ebreak': [],

  'cssrw': [['gpreg', ',', 'csreg', ',', 'gpreg']],
  'csrrs': [['gpreg', ',', 'csreg', ',', 'gpreg']],
  'csrrc': [['gpreg', ',', 'csreg', ',', 'gpreg']],
  'csrrwi': [['gpreg', ',', 'csreg', ',', 'imm']],
  'csrrsi': [['gpreg', ',', 'csreg', ',', 'imm']],
  'csrrci': [['gpreg', ',', 'csreg', ',', 'imm']],

  'mul': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'mulh': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'mulhsu': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'mulhu': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'div': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'divu': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'rem': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'remu': [['gpreg', ',', 'gpreg', ',', 'gpreg']],

  'mulw': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'divw': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'divuw': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'remw': [['gpreg', ',', 'gpreg', ',', 'gpreg']],
  'remuw': [['gpreg', ',', 'gpreg', ',', 'gpreg']],

  'flw': [['fpreg', ',', 'imm', '(', 'gpreg', ')']],
  'fsw': [['fpreg', ',', 'imm', '(', 'gpreg', ')']],

  'fmadd.s': [['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fmsub.s': [['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fnmsub.s': [['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fnmadd.s': [['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],

  'fadd.s': [['fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fsub.s': [['fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fmul.s': [['fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fdiv.s': [['fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],

  'fsqrt.s': [['fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'rounding_mode']],

  'fsgnj.s': [['fpreg', ',', 'fpreg', ',', 'fpreg']],
  'fsgnjn.s': [['fpreg', ',', 'fpreg', ',', 'fpreg']],
  'fsgnjx.s': [['fpreg', ',', 'fpreg', ',', 'fpreg']],
  'fmin.s': [['fpreg', ',', 'fpreg', ',', 'fpreg']],
  'fmax.s': [['fpreg', ',', 'fpreg', ',', 'fpreg']],

  'feq.s': [['gpreg', ',', 'fpreg', ',', 'fpreg']],
  'flt.s': [['gpreg', ',', 'fpreg', ',', 'fpreg']],
  'fle.s': [['gpreg', ',', 'fpreg', ',', 'fpreg']],

  'fclass.s': [['gpreg', ',', 'fpreg']],

  'fmv.x.w': [['gpreg', ',', 'fpreg']],
  'fmv.w.x': [['fpreg', ',', 'gpreg']],

  'fcvt.s.w': [['fpreg', ',', 'gpreg'], ['fpreg', ',', 'gpreg', ',', 'rounding_mode']],
  'fcvt.s.wu': [['fpreg', ',', 'gpreg'], ['fpreg', ',', 'gpreg', ',', 'rounding_mode']],
  'fcvt.s.l': [['fpreg', ',', 'gpreg'], ['fpreg', ',', 'gpreg', ',', 'rounding_mode']],
  'fcvt.s.lu': [['fpreg', ',', 'gpreg'], ['fpreg', ',', 'gpreg', ',', 'rounding_mode']],

  'fcvt.w.s': [['gpreg', ',', 'fpreg'], ['gpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fcvt.wu.s': [['gpreg', ',', 'fpreg'], ['gpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fcvt.l.s': [['gpreg', ',', 'fpreg'], ['gpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fcvt.lu.s': [['gpreg', ',', 'fpreg'], ['gpreg', ',', 'fpreg', ',', 'rounding_mode']],



  'fld': [['fpreg', ',', 'imm', '(', 'gpreg', ')']],
  'fsd': [['fpreg', ',', 'imm', '(', 'gpreg', ')']],

  'fmadd.d': [['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fmsub.d': [['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fnmsub.d': [['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fnmadd.d': [['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],

  'fadd.d': [['fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fsub.d': [['fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fmul.d': [['fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fdiv.d': [['fpreg', ',', 'fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'fpreg', ',', 'rounding_mode']],

  'fsqrt.d': [['fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'rounding_mode']],

  'fsgnj.d': [['fpreg', ',', 'fpreg', ',', 'fpreg']],
  'fsgnjn.d': [['fpreg', ',', 'fpreg', ',', 'fpreg']],
  'fsgnjx.d': [['fpreg', ',', 'fpreg', ',', 'fpreg']],
  'fmin.d': [['fpreg', ',', 'fpreg', ',', 'fpreg']],
  'fmax.d': [['fpreg', ',', 'fpreg', ',', 'fpreg']],

  'feq.d': [['gpreg', ',', 'fpreg', ',', 'fpreg']],
  'flt.d': [['gpreg', ',', 'fpreg', ',', 'fpreg']],
  'fle.d': [['gpreg', ',', 'fpreg', ',', 'fpreg']],

  'fclass.d': [['gpreg', ',', 'fpreg']],

  'fcvt.d.w': [['fpreg', ',', 'gpreg'], ['fpreg', ',', 'gpreg', ',', 'rounding_mode']],
  'fcvt.d.wu': [['fpreg', ',', 'gpreg'], ['fpreg', ',', 'gpreg', ',', 'rounding_mode']],
  'fcvt.d.l': [['fpreg', ',', 'gpreg'], ['fpreg', ',', 'gpreg', ',', 'rounding_mode']],
  'fcvt.d.lu': [['fpreg', ',', 'gpreg'], ['fpreg', ',', 'gpreg', ',', 'rounding_mode']],

  'fcvt.w.d': [['gpreg', ',', 'fpreg'], ['gpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fcvt.wu.d': [['gpreg', ',', 'fpreg'], ['gpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fcvt.l.d': [['gpreg', ',', 'fpreg'], ['gpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fcvt.lu.d': [['gpreg', ',', 'fpreg'], ['gpreg', ',', 'fpreg', ',', 'rounding_mode']],

  'fcvt.s.d': [['fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'rounding_mode']],
  'fcvt.d.s': [['fpreg', ',', 'fpreg'], ['fpreg', ',', 'fpreg', ',', 'rounding_mode']],

  'fmv.x.d': [['gpreg', ',', 'fpreg']],
  'fmv.d.x': [['fpreg', ',', 'gpreg']],

};


function returnTokens(line: string): string[] {
  const lineWithoutComment: string = line.split('#')[0].trim();

  if (lineWithoutComment.length === 0) {
    return [];
  }

  const lineTokens: string[] = lineWithoutComment.split(/\s+/);

  const processedTokens1: string[] = [];
  lineTokens.forEach(token => {
    if (token.includes(',')) {
      const splitTokens = token.split(',').flatMap((part, index, array) =>
        index < array.length - 1 ? [part, ','] : [part]
      );
      processedTokens1.push(...splitTokens);
    } else {
      processedTokens1.push(token);
    }
  });

  const processedTokens2: string[] = [];
  processedTokens1.forEach(token => {
    if (token.includes('(') || token.includes(')')) {
      const splitTokens = token.split(/([()])/).filter(part => part.trim() !== '');
      processedTokens2.push(...splitTokens);
    } else {
      processedTokens2.push(token);
    }
  });










  return processedTokens2.map(token => token.trim()).filter(token => token.length > 0);
}


interface Document {
  getText(): string;
}

interface Diagnostic {
  range: vscode.Range;
  message: string;
  severity: vscode.DiagnosticSeverity;
}

interface Range {
  start: number;
  end: number;
}

function lintDocument(document: Document): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines: string[] = document.getText().split('\n');


  lines.forEach((line: string, lineNumber: number) => {
    console.log(returnTokens(line));
  });

  return diagnostics;
  //     // Remove comments and trim the line
  //     const lineWithoutComment: string = line.split('#')[0].trim();

  //     // Skip empty lines
  //     if (lineWithoutComment.length === 0) {return;}

  //     // Split the line into tokens (words and operands)
  //     const tokens: string[] = lineWithoutComment.split(/\s+/);

  //     // If it's a label, check the next token
  //     if (labelRegex.test(tokens[0])) {
  //         let i: number = 1; // Start from the next token after the label
  //         while (i < tokens.length && labelRegex.test(tokens[i])) {
  //             i++; // Continue checking if the next token is another label
  //         }

  //         // If the next token is an instruction, validate the arguments
  //         if (i < tokens.length && tokens[i] in arg_types) {
  //             const instruction: string = tokens[i];
  //             const expectedArgs: string[] = arg_types[instruction as keyof typeof arg_types];
  //             const args: string[] = tokens.slice(i + 1);

  //             if (args.length !== expectedArgs.length) {
  //                 diagnostics.push(new vscode.Diagnostic(
  //                     new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                     `Incorrect number of operands for instruction: '${instruction}'. Expected ${expectedArgs.length}, found ${args.length}.`,
  //                     vscode.DiagnosticSeverity.Error
  //                 ));
  //             }

  //             // Validate each argument based on its type
  //             args.forEach((arg: string, index: number) => {
  //                 const expectedType: string = expectedArgs[index];
  //                 if (expectedType === 'gpreg' && !registerRegex.test(arg)) {
  //                     diagnostics.push(new vscode.Diagnostic(
  //                         new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                         `Invalid register: '${arg}' for instruction '${instruction}'.`,
  //                         vscode.DiagnosticSeverity.Error
  //                     ));
  //                 } else if (expectedType === 'imm' && !immediateRegex.test(arg)) {
  //                     diagnostics.push(new vscode.Diagnostic(
  //                         new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                         `Invalid immediate value: '${arg}' for instruction '${instruction}'.`,
  //                         vscode.DiagnosticSeverity.Error
  //                     ));
  //                 } else if (expectedType === 'label' && !labelRegex.test(arg)) {
  //                     diagnostics.push(new vscode.Diagnostic(
  //                         new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                         `Invalid label: '${arg}' for instruction '${instruction}'.`,
  //                         vscode.DiagnosticSeverity.Error
  //                     ));
  //                 }
  //             });
  //         } else {
  //             diagnostics.push(new vscode.Diagnostic(
  //                 new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                 `Invalid instruction after label: '${tokens[i]}'`,
  //                 vscode.DiagnosticSeverity.Error
  //             ));
  //         }
  //     } else if (tokens[0] in arg_types) {  // If it's not a label, but an instruction
  //         const instruction: string = tokens[0];
  //         const expectedArgs: string[] = arg_types[instruction as keyof typeof arg_types];
  //         const args: string[] = tokens.slice(1);

  //         if (args.length !== expectedArgs.length) {
  //             diagnostics.push(new vscode.Diagnostic(
  //                 new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                 `Incorrect number of operands for instruction: '${instruction}'. Expected ${expectedArgs.length}, found ${args.length}.`,
  //                 vscode.DiagnosticSeverity.Error
  //             ));
  //         }

  //         // Validate each argument based on its type
  //         args.forEach((arg: string, index: number) => {
  //             const expectedType: string = expectedArgs[index];
  //             if (expectedType === 'gpreg' && !registerRegex.test(arg)) {
  //                 diagnostics.push(new vscode.Diagnostic(
  //                     new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                     `Invalid register: '${arg}' for instruction '${instruction}'.`,
  //                     vscode.DiagnosticSeverity.Error
  //                 ));
  //             } else if (expectedType === 'imm' && !immediateRegex.test(arg)) {
  //                 diagnostics.push(new vscode.Diagnostic(
  //                     new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                     `Invalid immediate value: '${arg}' for instruction '${instruction}'.`,
  //                     vscode.DiagnosticSeverity.Error
  //                 ));
  //             } else if (expectedType === 'label' && !labelRegex.test(arg)) {
  //                 diagnostics.push(new vscode.Diagnostic(
  //                     new vscode.Range(lineNumber, 0, lineNumber, line.length),
  //                     `Invalid label: '${arg}' for instruction '${instruction}'.`,
  //                     vscode.DiagnosticSeverity.Error
  //                 ));
  //             }
  //         });
  //     }
  // });

  // return diagnostics;
}

interface Document {
  getText(): string;
  uri: vscode.Uri;
}

interface Diagnostics {
  set(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): void;
}

function validateISA(document: Document, diagnostics: Diagnostics): void {
  let diagnosticsList: vscode.Diagnostic[] = [];
  const text: string = document.getText();
  const lines: string[] = text.split("\n");

  // const instructionRegex: RegExp = /^(add|sub|xor)\s+(\w+),\s*(\w+),?\s*(\w+)?$/;

  lines.forEach((line: string, index: number) => {
    let match: RegExpExecArray | null = instructionRegex.exec(line);
    if (!match) {
      let diagnostic: vscode.Diagnostic = new vscode.Diagnostic(
        new vscode.Range(index, 0, index, line.length),
        "Syntax error in ISA assembly",
        vscode.DiagnosticSeverity.Error
      );
      diagnosticsList.push(diagnostic);
    }
  });

  diagnostics.set(document.uri, diagnosticsList);
}


let diagnosticCollection = vscode.languages.createDiagnosticCollection("riscv-linter");

// vscode.workspace.onDidChangeTextDocument(event => {
//   if (event.document.languageId === 'riscv') {
//     const diagnostics = lintDocument(event.document);
//     diagnosticCollection.set(event.document.uri, diagnostics);
//   }
// });

// vscode.workspace.onDidOpenTextDocument(document => {
//   if (document.languageId === 'riscv') {
//     const diagnostics = lintDocument(document);
//     diagnosticCollection.set(document.uri, diagnostics);
//   }
//   validateISA(document, diagnosticCollection);
// });


export { lintDocument, validateISA, diagnosticCollection };
