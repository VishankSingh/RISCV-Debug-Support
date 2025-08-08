import vscode from 'vscode';

const riscvKeywords = [
  "add", "sub", "and", "or", "xor", "sll", "srl", "sra", "slt", "sltu", "addi", "andi", "ori", "xori",
  "slli", "srli", "srai", "slti", "sltiu", "lb", "lh", "lw", "lbu", "lhu", "sb", "sh", "sw",
  "beq", "bne", "blt", "bge", "bltu", "bgeu", "lui", "auipc", "jal", "jalr", "ecall", "ebreak",

  "addw", "subw", "sllw", "srlw", "sraw", "addiw", "slliw", "srliw", "sraiw", "lwu", "ld", "sd",

  "csrrw", "csrrs", "csrrc", "csrrwi", "csrrsi", "csrrci",

  "mul", "mulh", "mulhsu", "mulhu", "div", "divu", "rem", "remu",
  "mulw", "divw", "divuw", "remw", "remuw",


  "flw", "fsw", "fmadd.s", "fmsub.s", "fnmadd.s", "fnmsub.s", "fadd.s", "fsub.s", "fmul.s", "fdiv.s",
  "fsqrt.s", "fsgnj.s", "fsgnjn.s", "fsgnjx.s", "fmin.s", "fmax.s", "fcvt.w.s", "fcvt.wu.s",
  "fcvt.s.w", "fcvt.s.wu", "feq.s", "flt.s", "fle.s", "fclass.s", "fmv.x.w", "fmv.w.x",

  "fcvt.l.s", "fcvt.lu.s", "fcvt.s.l", "fcvt.s.lu",

  "fld", "fsd", "fmadd.d", "fmsub.d", "fnmadd.d", "fnmsub.d", "fadd.d", "fsub.d", "fmul.d", "fdiv.d",
  "fsqrt.d", "fsgnj.d", "fsgnjn.d", "fsgnjx.d", "fmin.d", "fmax.d", "fcvt.w.d", "fcvt.wu.d",
  "fcvt.d.w", "fcvt.d.wu", "feq.d", "flt.d", "fle.d", "fclass.d", "fcvt.s.d", "fcvt.d.s",

  "fcvt.l.d", "fcvt.lu.d", "fcvt.d.l", "fcvt.d.lu", "fmv.x.d", "fmv.d.x"
];


const riscvRegisters = [
  "zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2",
  "s0", "s1", "a0", "a1", "a2", "a3", "a4", "a5",
  "a6", "a7", "s2", "s3", "s4", "s5", "s6", "s7",
  "s8", "s9", "s10", "s11", "t3", "t4", "t5", "t6",

  "x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7",
  "x8", "x9", "x10", "x11", "x12", "x13", "x14", "x15",
  "x16", "x17", "x18", "x19", "x20", "x21", "x22", "x23",
  "x24", "x25", "x26", "x27", "x28", "x29", "x30", "x31",

  "f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7",
  "f8", "f9", "f10", "f11", "f12", "f13", "f14", "f15",
  "f16", "f17", "f18", "f19", "f20", "f21", "f22", "f23",
  "f24", "f25", "f26", "f27", "f28", "f29", "f30", "f31",

  "ft0", "ft1", "ft2", "ft3", "ft4", "ft5", "ft6", "ft7",
  "fs0", "fs1", "fa0", "fa1", "fa2", "fa3", "fa4", "fa5",
  "fa6", "fa7", "fs2", "fs3", "fs4", "fs5", "fs6", "fs7",
  "fs8", "fs9", "fs10", "fs11", "ft8", "ft9", "ft10", "ft11",


  // "ft8", "ft9", "ft10", "ft11", "fs0", "fs1", "fa0", "fa1",
  // "fa2", "fa3", "fa4", "fa5", "fa6", "fa7", "fs2", "fs3",
  // "fs4", "fs5", "fs6", "fs7", "fs8", "fs9", "fs10", "fs11"

  "fflags", "frm", "fcsr"


];


const riscvDirectives = [
  "section", "data", "text", "byte", "half", "word", "dword", "float", "double", "string", "zero"
  // "ascii", "asciz",
  // "space", "global", "extern", "set", "equ", "org","globl", "align",
];

const riscvCompletions = [
  ...riscvKeywords.map(keyword => new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword)),
  ...riscvRegisters.map(register => new vscode.CompletionItem(register, vscode.CompletionItemKind.Variable)),
  ...riscvDirectives.map(directive => new vscode.CompletionItem(directive, vscode.CompletionItemKind.Keyword))
];

let completionProvider = vscode.languages.registerCompletionItemProvider(
  'riscv',
  {
    provideCompletionItems(document, position, token, context) {
      return riscvCompletions;
    }
  },
  '' // Trigger character (leave empty for all cases)
);

export { completionProvider };


