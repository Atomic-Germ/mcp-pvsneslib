#include <snes.h>

int main() {
    consoleInit();
    
    consoleInitText(0, 16, &snesfont);
    
    consoleSetTextVramBGAdr(0x6800);
    consoleSetTextVramAdr(0x3000);
    consoleSetTextOffset(0x0100);
    
    consoleSetTextCol(RGB15(31,31,0), RGB15(0,0,0));
    
    consoleDrawText(5, 10, "Hello World!");
    consoleDrawText(3, 12, "PVSnesLib Test!");
    
    setScreenOn();
    
    while(1) {
        WaitForVBlank();
    }
    return 0;
}