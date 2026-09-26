"""Read-only PE metadata and exact marker inspection; never executes the input."""
import argparse
import hashlib
import json
import mmap
import struct
from pathlib import Path

MARKERS = [
    'UWorld', 'PersistentLevel', 'OwningGameInstance', 'LocalPlayers',
    'PlayerController', 'AcknowledgedPawn', 'PlayerCameraManager',
    'CameraCachePrivate', 'FMinimalViewInfo', 'SkeletalMeshComponent',
    'GetBoneTransform', 'GetBoneMatrix', 'ComponentToWorld',
    'WDCharacter', 'WDPlayerController', 'WDPlayerState',
    'DemoNetDriver', 'ReplaySubsystem', 'NetworkReplayStreaming',
]


def inspect(path):
    with path.open('rb') as source, mmap.mmap(source.fileno(), 0, access=mmap.ACCESS_READ) as data:
        def unpack(fmt, offset):
            size = struct.calcsize(fmt)
            if offset < 0 or offset + size > len(data):
                raise ValueError('Truncated PE field')
            return struct.unpack_from(fmt, data, offset)

        if data[:2] != b'MZ':
            raise ValueError('Not a PE executable')
        pe = unpack('<I', 0x3c)[0]
        if data[pe:pe+4] != b'PE\0\0':
            raise ValueError('Invalid PE signature')
        machine, count, timestamp, symbols, symbol_count, optional_size, flags = unpack('<HHIIIHH', pe+4)
        optional = pe+24
        magic = unpack('<H', optional)[0]
        if magic not in (0x10b, 0x20b):
            raise ValueError('Unsupported optional header')
        sections = []
        for i in range(count):
            off = optional+optional_size+i*40
            name, virtual_size, rva, raw_size, raw_offset = unpack('<8sIIII', off)
            sections.append(dict(name=name.rstrip(b'\0').decode('ascii', 'replace'),
                                 virtual_size=virtual_size, rva=rva,
                                 raw_size=raw_size, file_offset=raw_offset))

        def file_offset(rva):
            for section in sections:
                delta = rva-section['rva']
                if 0 <= delta < section['raw_size']:
                    return section['file_offset']+delta
            raise ValueError('RVA is not in a file-backed section')

        directory_base = optional+(112 if magic == 0x20b else 96)
        directory_count = unpack('<I', directory_base-4)[0]
        imports = []
        if directory_count > 1:
            import_rva, import_size = unpack('<II', directory_base+8)
            if import_rva and import_size:
                start = file_offset(import_rva)
                for i in range(min(import_size//20, 4096)):
                    descriptor = unpack('<IIIII', start+i*20)
                    if not any(descriptor):
                        break
                    name_offset = file_offset(descriptor[3])
                    end = data.find(b'\0', name_offset, min(name_offset+512, len(data)))
                    if end == -1:
                        raise ValueError('Unterminated import name')
                    imports.append(data[name_offset:end].decode('ascii', 'replace'))
        markers = {}
        for marker in MARKERS:
            findings = {}
            for encoding in ('ascii', 'utf-16le'):
                needle = marker.encode(encoding)
                hits, cursor = [], 0
                while len(hits) < 8:
                    hit = data.find(needle, cursor)
                    if hit < 0:
                        break
                    hits.append(hex(hit))
                    cursor = hit+len(needle)
                if hits:
                    findings[encoding] = hits
            if findings:
                markers[marker] = findings
        return dict(filename=path.name, size=len(data), sha256=hashlib.sha256(data).hexdigest(),
                    machine=hex(machine), pe_format='PE32+' if magic == 0x20b else 'PE32',
                    coff_symbol_count=symbol_count, sections=sections, imported_dlls=imports,
                    marker_file_offsets=markers,
                    limitations='Marker hits are substrings at file offsets, not verified symbols, object layouts or runtime addresses. Up to 8 hits per encoding. Absence does not prove a feature is absent.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = inspect(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
