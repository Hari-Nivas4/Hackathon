const compressedText = "x«V*Q²RJÊO©TÒQJV²®dB¹J©99ù\náùE9)J±µ:élHFf±%*¤($%¦%dèÕÆÖ";
const compressedBuffer = Buffer.from(compressedText, "latin1");
const decompressedBuffer = pako.inflate(compressedBuffer);
const jsonString = decompressedBuffer.toString("utf8");
const minimalJSON = JSON.parse(jsonString);
console.log("Decompressed minimal JSON structure:", minimalJSON);
