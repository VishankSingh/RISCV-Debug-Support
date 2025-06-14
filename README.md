# riscv-debug-support

## Features  

- Support for RISC-V 64 IMFD and Zicsr(fflags, frm, fcsr) instructions
- Syscall support for `read (63)`, `write (64)`. (Currently only supporting stdin and stdout)
- Debug support with  
        - Breakpoint  
        - Single Step  
        - Step back  
        - Watchpoint for register and memory (x5, f5, csr, or mem[0x1000])

## Usage

- From [GitHub](https://github.com/VishankSingh/WIP-riscv-simulator-2), download the specific release or build it yourself.
- Make the release executable (if downloaded).
- In the extension settings, set the `Vm Binary Path` to the path of the binary.
- Open the Debug panel in VSCode and create a new launch configuration. (You may use the provided launch configuration snippets or create your own.)

> **Note:**  
> If you're writing a custom `launch.json`, you may use `"program": "${command:riscv-debug-support.riscvSimpleDebug.getProgramName}"`, but if it is missing,
the extension will resolve it at launch time.
