export interface MMIODevice {
    name: string;
    baseAddr: number;
    read(addr: number, size: number): number;
    write(addr: number, value: number, size: number): void;
    contains(addr: number): boolean;
}

export class MMIODeviceManager {
    private devices: MMIODevice[] = [];

    register(device: MMIODevice) {
        this.devices.push(device);
    }

    findDevice(addr: number): MMIODevice | undefined {
        return this.devices.find(device => device.contains(addr));
    }

    read(addr: number, size: number): number {
        const device = this.findDevice(addr);
        if (!device) throw new Error(`No MMIO device at address 0x${addr.toString(16)}`);
        return device.read(addr, size);
    }

    write(addr: number, value: number, size: number): void {
        const device = this.findDevice(addr);
        if (!device) throw new Error(`No MMIO device at address 0x${addr.toString(16)}`);
        device.write(addr, value, size);
    }


}

// Example MMIO Device: Simple Timer
export class TimerDevice implements MMIODevice {
    name: string = 'TimerDevice';
    // Base address and size of the timer device
    public baseAddr: number;
    private size: number;
    private counter: number = 0;

    constructor(baseAddr: number, size: number) {
        this.baseAddr = baseAddr;
        this.size = size;
    }

    contains(addr: number): boolean {
        return addr >= this.baseAddr && addr < this.baseAddr + this.size;
    }

    read(addr: number, size: number): number {
        // Only one register for simplicity
        if (addr === this.baseAddr && size === 4) {
            return this.counter;
        }
        throw new Error('Invalid read from TimerDevice');
    }

    write(addr: number, value: number, size: number): void {
        if (addr === this.baseAddr && size === 4) {
            this.counter = value;
            return;
        }
        throw new Error('Invalid write to TimerDevice');
    }
}