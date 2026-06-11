# WebDAV Protocol MVP Research

## Sources

- RFC 4918, WebDAV: https://www.rfc-editor.org/rfc/rfc4918
- RFC 7617, HTTP Basic Auth: https://www.rfc-editor.org/rfc/rfc7617

## Findings

WebDAV is an HTTP extension for resource properties, collection resources, namespace operations, and locking. The MVP only needs class-1 style file browsing operations: `PROPFIND`, `GET`, `HEAD`, `PUT`, `MKCOL`, and `DELETE`.

Directory listing should use `PROPFIND` with `Depth: 1`, then parse the `207 Multi-Status` XML response. Required properties for Akasha capsules are `displayname`, `resourcetype`, `getcontentlength`, `getlastmodified`, and `getetag`.

Collections are identified through `resourcetype` containing `collection`. The response usually includes the requested collection itself plus direct children, so the engine must filter out the self href.

WebDAV does not provide S3-style buckets. In Akasha, `bucket` should map to the first path segment under the configured WebDAV `url`, matching the existing non-bucket backend convention used by `LocalDarshan`.

Basic authentication can be implemented directly through the `Authorization: Basic ...` header. RFC 7617 states Basic authentication does not protect credentials by itself; Akasha should require or strongly enforce HTTPS for password-bearing WebDAV URLs unless a config escape hatch is added later.

## Recommendation

Use native `fetch` instead of a third-party client for M6. This keeps the project dependency-light and fits the current test style: inject a fetch-like function into `WebdavDarshan` tests and avoid network access.

Support plain `user` + `pass` only. Do not implement rclone obscure reveal in M6; document it as out of scope.
