# STATIC TEMPLATE — thin wrapper, copy verbatim, substitute operational-excellence.
# Applies the k8s manifests in ../k8s to the micro-app cluster. The rail/
# hardening team wires the real backend (provider auth, registry, ingress, SSO).

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

variable "app_name" {
  type    = string
  default = "operational-excellence"
}

variable "namespace" {
  type    = string
  default = "micro-apps"
}

# The hardening team typically renders these via kubectl/kustomize or a
# kubernetes_manifest per file. Left as a thin, obvious wrapper on purpose —
# elaborating it is hardening-team work, not citizen-builder work.
locals {
  manifests = fileset("${path.module}/../k8s", "*.yaml")
}
