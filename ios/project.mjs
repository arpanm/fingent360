export function validateIosConfig(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(input).sort().join(',') !== 'mode,webUrl' ||
    !['offline', 'connected'].includes(input.mode) ||
    typeof input.webUrl !== 'string'
  )
    throw Error('Use mode and webUrl only.');
  if (input.mode === 'offline') {
    if (input.webUrl !== '') throw Error('Offline has no remote URL.');
  } else {
    const url = new URL(input.webUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw Error('Connected mode needs a plain HTTPS origin.');
  }
  return input;
}
export const project = `// !$*UTF8*$!
{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {
A00000000000000000000001 = {isa = PBXProject; buildConfigurationList = A00000000000000000000010; compatibilityVersion = "Xcode 14.0"; mainGroup = A00000000000000000000002; targets = (A00000000000000000000003); };
A00000000000000000000002 = {isa = PBXGroup; children = (A00000000000000000000004,A00000000000000000000005,A00000000000000000000006,A00000000000000000000007,A00000000000000000000017,A00000000000000000000018); sourceTree = "<group>"; };
A00000000000000000000003 = {isa = PBXNativeTarget; buildConfigurationList = A00000000000000000000011; buildPhases = (A00000000000000000000008,A00000000000000000000009); buildRules = (); dependencies = (); name = Fingent360; productName = Fingent360; productReference = A00000000000000000000007; productType = "com.apple.product-type.application"; };
A00000000000000000000004 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = App.swift; sourceTree = "<group>"; };
A00000000000000000000005 = {isa = PBXFileReference; lastKnownFileType = folder; path = web; sourceTree = "<group>"; };
A00000000000000000000006 = {isa = PBXFileReference; lastKnownFileType = text.json; path = "runtime-config.json"; sourceTree = "<group>"; };
A00000000000000000000007 = {isa = PBXFileReference; explicitFileType = wrapper.application; path = Fingent360.app; sourceTree = BUILT_PRODUCTS_DIR; };
A00000000000000000000008 = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000014,A00000000000000000000019); runOnlyForDeploymentPostprocessing = 0; };
A00000000000000000000009 = {isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000015,A00000000000000000000016,A00000000000000000000020); runOnlyForDeploymentPostprocessing = 0; };
A00000000000000000000010 = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000012); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
A00000000000000000000011 = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000013); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
A00000000000000000000012 = {isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 16.0; SWIFT_VERSION = 5.0; }; };
A00000000000000000000013 = {isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.fingent360.preview; PRODUCT_NAME = Fingent360; INFOPLIST_FILE = Info.plist; CODE_SIGN_STYLE = Automatic; TARGETED_DEVICE_FAMILY = "1,2"; }; };
A00000000000000000000014 = {isa = PBXBuildFile; fileRef = A00000000000000000000004; };
A00000000000000000000015 = {isa = PBXBuildFile; fileRef = A00000000000000000000005; };
A00000000000000000000016 = {isa = PBXBuildFile; fileRef = A00000000000000000000006; };
A00000000000000000000017 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FeedbackBridge.swift; sourceTree = "<group>"; };
A00000000000000000000018 = {isa = PBXFileReference; lastKnownFileType = sourcecode.javascript; path = "feedback-bridge.js"; sourceTree = "<group>"; };
A00000000000000000000019 = {isa = PBXBuildFile; fileRef = A00000000000000000000017; };
A00000000000000000000020 = {isa = PBXBuildFile; fileRef = A00000000000000000000018; };
}; rootObject = A00000000000000000000001; }
`;
