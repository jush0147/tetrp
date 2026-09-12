import {deflateSync} from 'node:zlib';
// Original block-letter t icon. Generated at build time; no external artwork.
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const label=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([label,data])));return Buffer.concat([length,label,data,crc]);}
export function iconPNG(size){
  const rows=Buffer.alloc(size*(1+size*3));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=x/size,py=y/size;
    const ink=(px>=.26&&px<.74&&py>=.30&&py<.43)||(px>=.43&&px<.57&&py>=.24&&py<.70)||(px>=.43&&px<.69&&py>=.60&&py<.74);
    const color=ink?[46,234,203]:[6,25,35],offset=y*(1+size*3)+1+x*3;
    rows.set(color,offset);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
