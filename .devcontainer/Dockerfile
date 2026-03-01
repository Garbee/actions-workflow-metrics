FROM node:24-bookworm-slim AS node-src
FROM rhysd/actionlint:1.7.8 AS actionlint-src
FROM ghcr.io/hadolint/hadolint:v2.14.0-debian AS hadolint-src
FROM ghcr.io/zizmorcore/zizmor:1.21.0 AS zizmor-src

# Just setting this one up for re-use so it only needs to be updated in one place.
# Useful in case we add new stages so the same base is used everywhere.
FROM ubuntu:noble-20260113 AS base-runtime

FROM base-runtime AS dev-runtime

SHELL ["/bin/bash", "-euC", "-o", "pipefail", "-c"]

ARG DEBIAN_FRONTEND=noninteractive

ENV NODE_ENV=development \
    NPM_CONFIG_PREFIX=/usr/local \
    PNPM_HOME=/opt/pnpm \
    PNPM_STORE_PATH=/pnpm-store \
    PATH="/home/ubuntu/.local/bin:/usr/local/lib/node_modules/bin:/opt/pnpm:/usr/local/go/bin:/usr/local/bin:/usr/bin:${PATH}"

RUN <<EOF
GLOBAL_NODE_MODULES="/usr/local/lib/node_modules"
groupadd -r docker
usermod -aG staff ubuntu
usermod -aG docker ubuntu
usermod -aG docker root
chown -R root:staff /usr/local/bin
mkdir -p "${GLOBAL_NODE_MODULES}" \
  "${PNPM_HOME}" \
  "${PNPM_STORE_PATH}" \
  /etc/apt/sources.list.d \
  /etc/apt/keyrings
chmod 755 /etc/apt/keyrings
chmod 755 /etc/apt/sources.list.d
chmod -R 0775 "${PNPM_HOME}" "${GLOBAL_NODE_MODULES}" /usr/local/bin
chmod -R 0777 "${PNPM_STORE_PATH}"
chown -R ubuntu:staff "${PNPM_HOME}" "${PNPM_STORE_PATH}" "${GLOBAL_NODE_MODULES}"
chmod -R g+sw "${PNPM_HOME}" "${PNPM_STORE_PATH}" "${GLOBAL_NODE_MODULES}"
EOF

# Bring in toolchains/artifacts (optimized with --link)
COPY --link --from=hadolint-src   /bin/hadolint /usr/local/bin/
COPY --link --from=zizmor-src      /usr/bin/zizmor /usr/local/bin/zizmor
## Actionlint also has shellcheck in its bin
COPY --link --from=actionlint-src  /usr/local/bin/ /usr/local/bin/

# Symlink-dependent toolchains (cannot use --link)
COPY --from=node-src \
  --chown=0:50 \
  --exclude=*CHANGELOG.md \
  --exclude=*README.md \
  --exclude=bin/docker-entrypoint.sh \
  /usr/local/ /usr/local/
COPY --from=node-src \
  --chown=0:50 \
  /opt /opt

RUN --mount=type=cache,target=/var/cache/apt,id=apt-archives,sharing=shared \
  --mount=type=cache,target=/var/lib/apt/lists,id=apt-lists,sharing=locked \
  <<EOF
apt-get update
apt-get install -y --no-install-recommends \
  curl \
  software-properties-common \
  ca-certificates
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
chmod 0044 /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null
apt-get update
apt-get install -y --no-install-recommends \
  gh \
  git \
  sudo-rs \
  ssh

# Setup sudo access
echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu
chmod 0440 /etc/sudoers.d/ubuntu

# Global npm configuration
## This sets config for both root and regular users.
## Use the heredoc syntax so we also get comments in the image for reference in-use.
cat > /usr/local/etc/npmrc <<EONPMRC
## Disable funding messages and automatic audits
fund=false
audit=false
## Prefer the offline modules when possible to speed up installs
## Particularly useful in CI environments with caching enabled
prefer-offline=true
## Help network or registry issues by massaging the network config
## It is balanced to slowly back off up to the 120ms max on the
## final attempt.
## It should go like this: 3.75s, 7.5s, 15s, 30s, 60s, 120s.
## We politely back-off and delay instead of rushing retries
## so the registry is not hammered to cause an outage.
fetch-retries=6
fetch-retry-factor=2
fetch-retry-mintimeout=3750
fetch-retry-maxtimeout=120000
## Setup logging to be more efficient for containers
## Keep the default log level, but discard logs going to a fail.
loglevel=notice
logs-dir=/dev/null
EONPMRC

# Install pnpm globally
curl -fsSL https://get.pnpm.io/install.sh | \
  env PNPM_HOME="${PNPM_HOME}" \
      SHELL=/bin/bash \
  bash -

# Install GitHub copilot
curl -fsSL https://gh.io/copilot-install | bash

EOF

WORKDIR /workspace
