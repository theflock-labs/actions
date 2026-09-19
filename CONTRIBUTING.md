# Contributing

Use Node 24 and npm. Clone the repository, run `npm ci`, then `npm run check`. The Action ships committed bundles and a generated task schema; include regenerated `dist/` and `schema/` changes with source changes.

Contributions should eliminate unnecessary inference, strengthen outcome evidence, or enable a clear integration use case. Include a deterministic regression test for changed behavior. Adapter changes need a protocol test and a short account of what is and is not live-tested. Do not claim compatibility solely because a provider uses the word "OpenAI-compatible".

Protect the boundaries: trusted contract vs input data, model choice vs executable argv, success claims vs independent checks, estimates vs enforced bills, and reviewed runbooks vs automatic caching. Security controls in the local runner remain open source.

Use small PRs with a concrete example, expected behavior, and validation. Public issues are welcome for bugs and proposals; report vulnerabilities privately through the Security tab. Contributors retain copyright and license contributions under Apache-2.0. Be respectful, specific and constructive.
