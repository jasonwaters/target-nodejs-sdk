/* eslint-disable no-bitwise */
import { perfTool } from "@adobe/target-tools";
import { SUPPORTED_ARTIFACT_OBFUSCATION_VERSION } from "./constants";
import Messages from "./messages";

const HEADER_BOUNDARY = 40;

/**
 * The ObfuscationProvider initialize method
 * @param {import("../types/DecisioningConfig").DecisioningConfig} config Options map, required
 */
function ObfuscationProvider(config) {
  const { organizationId } = config;
  const decoder = new TextDecoder("utf-8");

  function getHeader(buffer) {
    const dataView = new DataView(buffer);
    const text = decoder.decode(dataView);

    const [prefix, version] = text.slice(0, 8).split(":");
    const key = text.slice(8, 41);

    return {
      prefix,
      version: parseInt(version, 10),
      key
    };
  }

  function getArtifact(key, obfuscatedArtifactBuffer) {
    let deobfuscatedArtifactJSON = {};

    perfTool.timeStart("deobfuscate_artifact");
    const keyBuffer = new TextEncoder().encode([organizationId, key].join(""));

    const keyView = new DataView(keyBuffer.buffer);
    const keyLength = keyView.byteLength;

    const obfuscatedArtifactView = new DataView(obfuscatedArtifactBuffer);
    const artifactLength = obfuscatedArtifactView.byteLength;

    const deobfuscatedArtifactView = new DataView(
      new ArrayBuffer(artifactLength)
    );

    for (let i = 0; i < artifactLength; i += 1) {
      deobfuscatedArtifactView.setInt8(
        i,
        obfuscatedArtifactView.getInt8(i) ^ keyView.getInt8(i % keyLength)
      );
    }
    perfTool.timeEnd("deobfuscate_artifact");

    const deobfuscatedArtifactString = decoder.decode(deobfuscatedArtifactView);

    try {
      perfTool.timeStart("deobfuscate_parseJSON");
      deobfuscatedArtifactJSON = JSON.parse(deobfuscatedArtifactString);
      perfTool.timeEnd("deobfuscate_parseJSON");
    } catch (err) {
      throw new Error(Messages.ARTIFACT_OBFUSCATION_ERROR);
    }

    return deobfuscatedArtifactJSON;
  }

  function deobfuscate(buffer) {
    perfTool.timeStart("deobfuscate_header");
    const header = getHeader(buffer.slice(0, HEADER_BOUNDARY));
    perfTool.timeEnd("deobfuscate_header");

    if (header.version !== SUPPORTED_ARTIFACT_OBFUSCATION_VERSION) {
      throw new Error(Messages.ARTIFACT_INVALID);
    }

    return getArtifact(header.key, buffer.slice(HEADER_BOUNDARY));
  }

  return {
    deobfuscate
  };
}

export default ObfuscationProvider;
