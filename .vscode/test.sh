AMEND=""
AMD64_VERSION="amd64-next"
if [ -n $AMD64_VERSION ]; then
  AMEND+=" --amend docker.io/okurinnyi/che-dashboard:$AMD64_VERSION";
fi
ARM64_VERSION="arm64-next"
if [ -n $ARM64_VERSION ]; then
  AMEND+=" --amend docker.io/okurinnyi/che-dashboard:$ARM64_VERSION";
fi
PPC64LE_VERSION="ppc64le-next"
if [ -n $PPC64LE_VERSION ]; then
  AMEND+=" --amend docker.io/okurinnyi/che-dashboard:$PPC64LE_VERSION";
fi
S390X_VERSION=""
if [ -n "$S390X_VERSION" ]; then
  echo "fck"
  AMEND+=" --amend docker.io/okurinnyi/che-dashboard:$S390X_VERSION";
fi
if [ -z "$AMEND" ]; then
  echo "[!] Provide at least one image to create manifest list"
  exit 1;
fi
echo "docker manifest create docker.io/okurinnyi/che-dashboard:manifest-next $AMEND"
# docker manifest push docker.io/okurinnyi/che-dashboard:manifest-next
