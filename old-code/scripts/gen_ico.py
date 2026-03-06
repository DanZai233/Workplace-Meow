#!/usr/bin/env python3
"""生成符合 llvm-rc 要求的最小 Windows ICO（Reserved 字段为 0）。"""
import struct

def write_ico(path, size=32):
    # ICO 文件头: reserved(2), type(2)=1, count(2)=1
    header = struct.pack('<HHH', 0, 1, 1)
    # 位图: 40 字节 BITMAPINFOHEADER + 像素 (BGRA) + AND mask
    # 高为 2*size 因为 ICO 里含 XOR+AND
    row_bytes = ((size * 4 + 3) // 4) * 4
    and_row = ((size + 31) // 32) * 4
    bmp_size = 40 + row_bytes * size + and_row * size
    # ICONDIRENTRY: width, height, colors=0, reserved=0, planes=1, bpp=32, size, offset
    offset = 6 + 16
    entry = struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, bmp_size, offset)
    # BITMAPINFOHEADER
    bi_size = 40
    bi_width = size
    bi_height = size * 2  # XOR + AND
    bi_planes = 1
    bi_bit_count = 32
    bi_compression = 0
    bi_size_image = row_bytes * size + and_row * size
    bi_header = struct.pack(
        '<IiiHHIIiiII',
        bi_size, bi_width, bi_height, bi_planes, bi_bit_count,
        bi_compression, bi_size_image, 0, 0, 0, 0
    )
    # 像素数据: BMP 自底向上，先写最后一行
    pixel_row = b'\xed\x95\x64\xff' * size + b'\x00' * (row_bytes - size * 4)  # BGRA 蓝
    pixels = b''.join([pixel_row for _ in range(size)][::-1])
    # AND mask: 每行 4 字节对齐，1bpp
    and_mask = b'\x00' * (and_row * size)
    with open(path, 'wb') as f:
        f.write(header)
        f.write(entry)
        f.write(bi_header)
        f.write(pixels)
        f.write(and_mask)
    print(f'Written {path} ({size}x{size})')

if __name__ == '__main__':
    import os
    out = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons', 'icon.ico')
    write_ico(out)
