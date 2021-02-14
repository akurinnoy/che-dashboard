AMEND=""
AMD64="amd64-next"
if [ -n $AMD64 ]; then
  AMEND+=" --amend docker.io/okurinnyi/che-dashboard:$AMD64";
fi
ARM64="arm64-next"
if [ -n $ARM64 ]; then
  AMEND+=" --amend docker.io/okurinnyi/che-dashboard:$ARM64";
fi
PPC64lE="ppc64le-next"
if [ -n $PPC64lE ]; then
  AMEND+=" --amend docker.io/okurinnyi/che-dashboard:$PPC64lE";
fi
S390X="s390x-next"
if [ -n $S390X ]; then
  AMEND+=" --amend docker.io/okurinnyi/che-dashboard:$S390X";
fi
if [ -z "$AMEND" ]; then
  echo "[!] Provide at least one image to create manifest list"
  exit 1;
fi
echo "docker manifest create docker.io/okurinnyi/che-dashboard:manifest-next $AMEND"
