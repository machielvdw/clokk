# Reference Homebrew formula for clokk.
# Copy this to your homebrew-tap repository at Formula/clokk.rb.
# The release workflow auto-generates the real formula with correct
# versions and checksums — this file is a template only.

class Clokk < Formula
  desc "A local-first CLI time tracker built for humans and AI agents"
  homepage "https://github.com/machielvdw/clokk"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/machielvdw/clokk/releases/download/v0.1.0/clokk-darwin-arm64"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/machielvdw/clokk/releases/download/v0.1.0/clokk-darwin-x64"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/machielvdw/clokk/releases/download/v0.1.0/clokk-linux-arm64"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/machielvdw/clokk/releases/download/v0.1.0/clokk-linux-x64"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    binary = Dir.children(".").first
    bin.install binary => "clokk"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/clokk --version").strip
  end
end
