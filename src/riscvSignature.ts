import vscode from 'vscode';

// Define the RISCV instructions with their parameters.
const riscvSignatures: Record<string, [string, string]> = {
  "add": ["add rd, rs1, rs2", "Adds rs1 and rs2, stores result in rd"],
  "sub": ["sub rd, rs1, rs2", "Subtracts rs2 from rs1, stores result in rd"],
  "mul": ["mul rd, rs1, rs2", "Multiplies rs1 and rs2, stores result in rd"],
  "div": ["div rd, rs1, rs2", "Divides rs1 by rs2, stores result in rd"],
  "xor": ["xor rd, rs1, rs2", "Performs bitwise XOR on rs1 and rs2, stores in rd"],
  "and": ["and rd, rs1, rs2", "Performs bitwise AND on rs1 and rs2, stores in rd"],
  "or": ["or rd, rs1, rs2", "Performs bitwise OR on rs1 and rs2, stores in rd"],
  "addi": ["addi rd, rs1, imm", "Adds immediate value to rs1, stores result in rd"],
  "lw": ["lw rd, offset(rs1)", "Loads word from memory at address rs1 + offset into rd"],
  "sw": ["sw rs2, offset(rs1)", "Stores word from rs2 into memory at address rs1 + offset"],
  "beq": ["beq rs1, rs2, label", "Branches to label if rs1 == rs2"],
  "bne": ["bne rs1, rs2, label", "Branches to label if rs1 != rs2"],
  "blt": ["blt rs1, rs2, label", "Branches to label if rs1 < rs2"],
  "bge": ["bge rs1, rs2, label", "Branches to label if rs1 >= rs2"],
  "jal": ["jal rd, label", "Jumps to label and stores return address in rd"],
  "jalr": ["jalr rd, offset(rs1)", "Jumps to rs1 + offset and stores return address in rd"],
  "ebreak": ["ebreak", "Breakpoint instruction"],
  "ecall": ["ecall", "Environment call"]
};

// Signature Help Provider (Parameter Hints)
const signatureProvider = vscode.languages.registerSignatureHelpProvider(
  'riscv',
  {
    provideSignatureHelp(
      document: vscode.TextDocument,
      position: vscode.Position,
      token: vscode.CancellationToken
    ): vscode.SignatureHelp | null {
      const lineText: string = document.lineAt(position.line).text.trim();
      const words: string[] = lineText.split(/\s+/);
      const instruction: string = words[0]; // Get the instruction word

      // If the instruction is not in the riscvSignatures, do not provide signature help
      if (!(instruction in riscvSignatures)) { return null; }

      const [signatureText, description]: [string, string] = riscvSignatures[instruction];

      const signatureHelp: vscode.SignatureHelp = new vscode.SignatureHelp();
      const signature: vscode.SignatureInformation = new vscode.SignatureInformation(signatureText, description);

      // Extract parameters (ignore instruction name)
      const params: string[] = signatureText.split(/\s|,/).slice(1);
      signature.parameters = params.map((param: string) => new vscode.ParameterInformation(param));

      // Correctly count active parameter based on cursor position
      const textBeforeCursor: string = lineText.substring(0, position.character);
      const typedParams: string = textBeforeCursor.replace(instruction, '').trim();

      // Detect if the current word is a label (no space after it, ends with colon)
      const isLabel: RegExpMatchArray | null = typedParams.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/);

      // Handle parameter counting, accounting for label and commas
      const commaCount: number = (typedParams.match(/,/g) || []).length;
      if (isLabel) {
        // If we're in the label part of the instruction (after rs1, rs2), set active to label
        signatureHelp.activeParameter = params.length - 1;  // Last parameter is the label
      } else {
        signatureHelp.activeParameter = Math.min(commaCount, params.length - 1);  // Ensure active parameter is valid
      }

      signatureHelp.signatures = [signature];
      signatureHelp.activeSignature = 0;

      return signatureHelp;
    }
  },
  ' ', ',' // Trigger on space or comma
);

export { signatureProvider, riscvSignatures };
