#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/base64url/dist/pad-string.js
var require_pad_string = __commonJS({
  "node_modules/base64url/dist/pad-string.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function padString(input) {
      var segmentLength = 4;
      var stringLength = input.length;
      var diff = stringLength % segmentLength;
      if (!diff) {
        return input;
      }
      var position = stringLength;
      var padLength = segmentLength - diff;
      var paddedStringLength = stringLength + padLength;
      var buffer = Buffer.alloc(paddedStringLength);
      buffer.write(input);
      while (padLength--) {
        buffer.write("=", position++);
      }
      return buffer.toString();
    }
    exports.default = padString;
  }
});

// node_modules/base64url/dist/base64url.js
var require_base64url = __commonJS({
  "node_modules/base64url/dist/base64url.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var pad_string_1 = require_pad_string();
    function encode(input, encoding) {
      if (encoding === void 0) {
        encoding = "utf8";
      }
      if (Buffer.isBuffer(input)) {
        return fromBase64(input.toString("base64"));
      }
      return fromBase64(Buffer.from(input, encoding).toString("base64"));
    }
    function decode(base64url4, encoding) {
      if (encoding === void 0) {
        encoding = "utf8";
      }
      return Buffer.from(toBase64(base64url4), "base64").toString(encoding);
    }
    function toBase64(base64url4) {
      base64url4 = base64url4.toString();
      return pad_string_1.default(base64url4).replace(/\-/g, "+").replace(/_/g, "/");
    }
    function fromBase64(base64) {
      return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    }
    function toBuffer(base64url4) {
      return Buffer.from(toBase64(base64url4), "base64");
    }
    var base64url3 = encode;
    base64url3.encode = encode;
    base64url3.decode = decode;
    base64url3.toBase64 = toBase64;
    base64url3.fromBase64 = fromBase64;
    base64url3.toBuffer = toBuffer;
    exports.default = base64url3;
  }
});

// node_modules/base64url/index.js
var require_base64url2 = __commonJS({
  "node_modules/base64url/index.js"(exports, module) {
    module.exports = require_base64url().default;
    module.exports.default = module.exports;
  }
});

// src/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  Horizon,
  Keypair as Keypair2,
  rpc,
  authorizeEntry,
  xdr as xdr3,
  scValToNative
} from "@stellar/stellar-sdk";
import { basicNodeSigner as basicNodeSigner2 } from "@stellar/stellar-sdk/contract";

// src/utils.ts
import path from "path";
import fs from "fs/promises";

// build/sac-sdk.js
import { Buffer as Buffer2 } from "buffer";
import {
  Client as ContractClient,
  Spec as ContractSpec
} from "@stellar/stellar-sdk/minimal/contract";
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer2;
}
var Client = class extends ContractClient {
  constructor(options) {
    super(
      new ContractSpec([
        "AAAAAAAAAYpSZXR1cm5zIHRoZSBhbGxvd2FuY2UgZm9yIGBzcGVuZGVyYCB0byB0cmFuc2ZlciBmcm9tIGBmcm9tYC4KClRoZSBhbW91bnQgcmV0dXJuZWQgaXMgdGhlIGFtb3VudCB0aGF0IHNwZW5kZXIgaXMgYWxsb3dlZCB0byB0cmFuc2ZlcgpvdXQgb2YgZnJvbSdzIGJhbGFuY2UuIFdoZW4gdGhlIHNwZW5kZXIgdHJhbnNmZXJzIGFtb3VudHMsIHRoZSBhbGxvd2FuY2UKd2lsbCBiZSByZWR1Y2VkIGJ5IHRoZSBhbW91bnQgdHJhbnNmZXJyZWQuCgojIEFyZ3VtZW50cwoKKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSBiYWxhbmNlIG9mIHRva2VucyB0byBiZSBkcmF3biBmcm9tLgoqIGBzcGVuZGVyYCAtIFRoZSBhZGRyZXNzIHNwZW5kaW5nIHRoZSB0b2tlbnMgaGVsZCBieSBgZnJvbWAuAAAAAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAIlSZXR1cm5zIHRydWUgaWYgYGlkYCBpcyBhdXRob3JpemVkIHRvIHVzZSBpdHMgYmFsYW5jZS4KCiMgQXJndW1lbnRzCgoqIGBpZGAgLSBUaGUgYWRkcmVzcyBmb3Igd2hpY2ggdG9rZW4gYXV0aG9yaXphdGlvbiBpcyBiZWluZyBjaGVja2VkLgAAAAAAAAphdXRob3JpemVkAAAAAAABAAAAAAAAAAJpZAAAAAAAEwAAAAEAAAAB",
        "AAAAAAAAA59TZXQgdGhlIGFsbG93YW5jZSBieSBgYW1vdW50YCBmb3IgYHNwZW5kZXJgIHRvIHRyYW5zZmVyL2J1cm4gZnJvbQpgZnJvbWAuCgpUaGUgYW1vdW50IHNldCBpcyB0aGUgYW1vdW50IHRoYXQgc3BlbmRlciBpcyBhcHByb3ZlZCB0byB0cmFuc2ZlciBvdXQgb2YKZnJvbSdzIGJhbGFuY2UuIFRoZSBzcGVuZGVyIHdpbGwgYmUgYWxsb3dlZCB0byB0cmFuc2ZlciBhbW91bnRzLCBhbmQKd2hlbiBhbiBhbW91bnQgaXMgdHJhbnNmZXJyZWQgdGhlIGFsbG93YW5jZSB3aWxsIGJlIHJlZHVjZWQgYnkgdGhlCmFtb3VudCB0cmFuc2ZlcnJlZC4KCiMgQXJndW1lbnRzCgoqIGBmcm9tYCAtIFRoZSBhZGRyZXNzIGhvbGRpbmcgdGhlIGJhbGFuY2Ugb2YgdG9rZW5zIHRvIGJlIGRyYXduIGZyb20uCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYmVpbmcgYXV0aG9yaXplZCB0byBzcGVuZCB0aGUgdG9rZW5zIGhlbGQgYnkKYGZyb21gLgoqIGBhbW91bnRgIC0gVGhlIHRva2VucyB0byBiZSBtYWRlIGF2YWlsYWJsZSB0byBgc3BlbmRlcmAuCiogYGV4cGlyYXRpb25fbGVkZ2VyYCAtIFRoZSBsZWRnZXIgbnVtYmVyIHdoZXJlIHRoaXMgYWxsb3dhbmNlIGV4cGlyZXMuIENhbm5vdApiZSBsZXNzIHRoYW4gdGhlIGN1cnJlbnQgbGVkZ2VyIG51bWJlciB1bmxlc3MgdGhlIGFtb3VudCBpcyBiZWluZyBzZXQgdG8gMC4KQW4gZXhwaXJlZCBlbnRyeSAod2hlcmUgZXhwaXJhdGlvbl9sZWRnZXIgPCB0aGUgY3VycmVudCBsZWRnZXIgbnVtYmVyKQpzaG91bGQgYmUgdHJlYXRlZCBhcyBhIDAgYW1vdW50IGFsbG93YW5jZS4KCiMgRXZlbnRzCgpFbWl0cyBhbiBldmVudCB3aXRoIHRvcGljcyBgWyJhcHByb3ZlIiwgZnJvbTogQWRkcmVzcywKc3BlbmRlcjogQWRkcmVzc10sIGRhdGEgPSBbYW1vdW50OiBpMTI4LCBleHBpcmF0aW9uX2xlZGdlcjogdTMyXWAAAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAEZnJvbQAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAABFleHBpcmF0aW9uX2xlZGdlcgAAAAAAAAQAAAAA",
        "AAAAAAAAAJhSZXR1cm5zIHRoZSBiYWxhbmNlIG9mIGBpZGAuCgojIEFyZ3VtZW50cwoKKiBgaWRgIC0gVGhlIGFkZHJlc3MgZm9yIHdoaWNoIGEgYmFsYW5jZSBpcyBiZWluZyBxdWVyaWVkLiBJZiB0aGUKYWRkcmVzcyBoYXMgbm8gZXhpc3RpbmcgYmFsYW5jZSwgcmV0dXJucyAwLgAAAAdiYWxhbmNlAAAAAAEAAAAAAAAAAmlkAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAWJCdXJuIGBhbW91bnRgIGZyb20gYGZyb21gLgoKUmVkdWNlcyBmcm9tJ3MgYmFsYW5jZSBieSB0aGUgYW1vdW50LCB3aXRob3V0IHRyYW5zZmVycmluZyB0aGUgYmFsYW5jZQp0byBhbm90aGVyIGhvbGRlcidzIGJhbGFuY2UuCgojIEFyZ3VtZW50cwoKKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSBiYWxhbmNlIG9mIHRva2VucyB3aGljaCB3aWxsIGJlCmJ1cm5lZCBmcm9tLgoqIGBhbW91bnRgIC0gVGhlIGFtb3VudCBvZiB0b2tlbnMgdG8gYmUgYnVybmVkLgoKIyBFdmVudHMKCkVtaXRzIGFuIGV2ZW50IHdpdGggdG9waWNzIGBbImJ1cm4iLCBmcm9tOiBBZGRyZXNzXSwgZGF0YSA9IGFtb3VudDoKaTEyOGAAAAAAAARidXJuAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAtpCdXJuIGBhbW91bnRgIGZyb20gYGZyb21gLCBjb25zdW1pbmcgdGhlIGFsbG93YW5jZSBvZiBgc3BlbmRlcmAuCgpSZWR1Y2VzIGZyb20ncyBiYWxhbmNlIGJ5IHRoZSBhbW91bnQsIHdpdGhvdXQgdHJhbnNmZXJyaW5nIHRoZSBiYWxhbmNlCnRvIGFub3RoZXIgaG9sZGVyJ3MgYmFsYW5jZS4KClRoZSBzcGVuZGVyIHdpbGwgYmUgYWxsb3dlZCB0byBidXJuIHRoZSBhbW91bnQgZnJvbSBmcm9tJ3MgYmFsYW5jZSwgaWYKdGhlIGFtb3VudCBpcyBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gdGhlIGFsbG93YW5jZSB0aGF0IHRoZSBzcGVuZGVyIGhhcwpvbiB0aGUgZnJvbSdzIGJhbGFuY2UuIFRoZSBzcGVuZGVyJ3MgYWxsb3dhbmNlIG9uIGZyb20ncyBiYWxhbmNlIHdpbGwgYmUKcmVkdWNlZCBieSB0aGUgYW1vdW50LgoKIyBBcmd1bWVudHMKCiogYHNwZW5kZXJgIC0gVGhlIGFkZHJlc3MgYXV0aG9yaXppbmcgdGhlIGJ1cm4sIGFuZCBoYXZpbmcgaXRzIGFsbG93YW5jZQpjb25zdW1lZCBkdXJpbmcgdGhlIGJ1cm4uCiogYGZyb21gIC0gVGhlIGFkZHJlc3MgaG9sZGluZyB0aGUgYmFsYW5jZSBvZiB0b2tlbnMgd2hpY2ggd2lsbCBiZQpidXJuZWQgZnJvbS4KKiBgYW1vdW50YCAtIFRoZSBhbW91bnQgb2YgdG9rZW5zIHRvIGJlIGJ1cm5lZC4KCiMgRXZlbnRzCgpFbWl0cyBhbiBldmVudCB3aXRoIHRvcGljcyBgWyJidXJuIiwgZnJvbTogQWRkcmVzc10sIGRhdGEgPSBhbW91bnQ6CmkxMjhgAAAAAAAJYnVybl9mcm9tAAAAAAAAAwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAVFDbGF3YmFjayBgYW1vdW50YCBmcm9tIGBmcm9tYCBhY2NvdW50LiBgYW1vdW50YCBpcyBidXJuZWQgaW4gdGhlCmNsYXdiYWNrIHByb2Nlc3MuCgojIEFyZ3VtZW50cwoKKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBob2xkaW5nIHRoZSBiYWxhbmNlIGZyb20gd2hpY2ggdGhlIGNsYXdiYWNrIHdpbGwKdGFrZSB0b2tlbnMuCiogYGFtb3VudGAgLSBUaGUgYW1vdW50IG9mIHRva2VucyB0byBiZSBjbGF3ZWQgYmFjay4KCiMgRXZlbnRzCgpFbWl0cyBhbiBldmVudCB3aXRoIHRvcGljcyBgWyJjbGF3YmFjayIsIGFkbWluOiBBZGRyZXNzLCB0bzogQWRkcmVzc10sCmRhdGEgPSBhbW91bnQ6IGkxMjhgAAAAAAAACGNsYXdiYWNrAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAIBSZXR1cm5zIHRoZSBudW1iZXIgb2YgZGVjaW1hbHMgdXNlZCB0byByZXByZXNlbnQgYW1vdW50cyBvZiB0aGlzIHRva2VuLgoKIyBQYW5pY3MKCklmIHRoZSBjb250cmFjdCBoYXMgbm90IHlldCBiZWVuIGluaXRpYWxpemVkLgAAAAhkZWNpbWFscwAAAAAAAAABAAAABA==",
        "AAAAAAAAAPNNaW50cyBgYW1vdW50YCB0byBgdG9gLgoKIyBBcmd1bWVudHMKCiogYHRvYCAtIFRoZSBhZGRyZXNzIHdoaWNoIHdpbGwgcmVjZWl2ZSB0aGUgbWludGVkIHRva2Vucy4KKiBgYW1vdW50YCAtIFRoZSBhbW91bnQgb2YgdG9rZW5zIHRvIGJlIG1pbnRlZC4KCiMgRXZlbnRzCgpFbWl0cyBhbiBldmVudCB3aXRoIHRvcGljcyBgWyJtaW50IiwgYWRtaW46IEFkZHJlc3MsIHRvOiBBZGRyZXNzXSwgZGF0YQo9IGFtb3VudDogaTEyOGAAAAAABG1pbnQAAAACAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAFlSZXR1cm5zIHRoZSBuYW1lIGZvciB0aGlzIHRva2VuLgoKIyBQYW5pY3MKCklmIHRoZSBjb250cmFjdCBoYXMgbm90IHlldCBiZWVuIGluaXRpYWxpemVkLgAAAAAAAARuYW1lAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAQxTZXRzIHRoZSBhZG1pbmlzdHJhdG9yIHRvIHRoZSBzcGVjaWZpZWQgYWRkcmVzcyBgbmV3X2FkbWluYC4KCiMgQXJndW1lbnRzCgoqIGBuZXdfYWRtaW5gIC0gVGhlIGFkZHJlc3Mgd2hpY2ggd2lsbCBoZW5jZWZvcnRoIGJlIHRoZSBhZG1pbmlzdHJhdG9yCm9mIHRoaXMgdG9rZW4gY29udHJhY3QuCgojIEV2ZW50cwoKRW1pdHMgYW4gZXZlbnQgd2l0aCB0b3BpY3MgYFsic2V0X2FkbWluIiwgYWRtaW46IEFkZHJlc3NdLCBkYXRhID0KW25ld19hZG1pbjogQWRkcmVzc11gAAAACXNldF9hZG1pbgAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAEZSZXR1cm5zIHRoZSBhZG1pbiBvZiB0aGUgY29udHJhY3QuCgojIFBhbmljcwoKSWYgdGhlIGFkbWluIGlzIG5vdCBzZXQuAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAVBTZXRzIHdoZXRoZXIgdGhlIGFjY291bnQgaXMgYXV0aG9yaXplZCB0byB1c2UgaXRzIGJhbGFuY2UuIElmCmBhdXRob3JpemVkYCBpcyB0cnVlLCBgaWRgIHNob3VsZCBiZSBhYmxlIHRvIHVzZSBpdHMgYmFsYW5jZS4KCiMgQXJndW1lbnRzCgoqIGBpZGAgLSBUaGUgYWRkcmVzcyBiZWluZyAoZGUtKWF1dGhvcml6ZWQuCiogYGF1dGhvcml6ZWAgLSBXaGV0aGVyIG9yIG5vdCBgaWRgIGNhbiB1c2UgaXRzIGJhbGFuY2UuCgojIEV2ZW50cwoKRW1pdHMgYW4gZXZlbnQgd2l0aCB0b3BpY3MgYFsic2V0X2F1dGhvcml6ZWQiLCBpZDogQWRkcmVzc10sIGRhdGEgPQpbYXV0aG9yaXplOiBib29sXWAAAAAOc2V0X2F1dGhvcml6ZWQAAAAAAAIAAAAAAAAAAmlkAAAAAAATAAAAAAAAAAlhdXRob3JpemUAAAAAAAABAAAAAA==",
        "AAAAAAAAAFtSZXR1cm5zIHRoZSBzeW1ib2wgZm9yIHRoaXMgdG9rZW4uCgojIFBhbmljcwoKSWYgdGhlIGNvbnRyYWN0IGhhcyBub3QgeWV0IGJlZW4gaW5pdGlhbGl6ZWQuAAAAAAZzeW1ib2wAAAAAAAAAAAABAAAAEA==",
        "AAAAAAAAAWJUcmFuc2ZlciBgYW1vdW50YCBmcm9tIGBmcm9tYCB0byBgdG9gLgoKIyBBcmd1bWVudHMKCiogYGZyb21gIC0gVGhlIGFkZHJlc3MgaG9sZGluZyB0aGUgYmFsYW5jZSBvZiB0b2tlbnMgd2hpY2ggd2lsbCBiZQp3aXRoZHJhd24gZnJvbS4KKiBgdG9gIC0gVGhlIGFkZHJlc3Mgd2hpY2ggd2lsbCByZWNlaXZlIHRoZSB0cmFuc2ZlcnJlZCB0b2tlbnMuCiogYGFtb3VudGAgLSBUaGUgYW1vdW50IG9mIHRva2VucyB0byBiZSB0cmFuc2ZlcnJlZC4KCiMgRXZlbnRzCgpFbWl0cyBhbiBldmVudCB3aXRoIHRvcGljcyBgWyJ0cmFuc2ZlciIsIGZyb206IEFkZHJlc3MsIHRvOiBBZGRyZXNzXSwKZGF0YSA9IGFtb3VudDogaTEyOGAAAAAAAAh0cmFuc2ZlcgAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAzFUcmFuc2ZlciBgYW1vdW50YCBmcm9tIGBmcm9tYCB0byBgdG9gLCBjb25zdW1pbmcgdGhlIGFsbG93YW5jZSB0aGF0CmBzcGVuZGVyYCBoYXMgb24gYGZyb21gJ3MgYmFsYW5jZS4gQXV0aG9yaXplZCBieSBzcGVuZGVyCihgc3BlbmRlci5yZXF1aXJlX2F1dGgoKWApLgoKVGhlIHNwZW5kZXIgd2lsbCBiZSBhbGxvd2VkIHRvIHRyYW5zZmVyIHRoZSBhbW91bnQgZnJvbSBmcm9tJ3MgYmFsYW5jZQppZiB0aGUgYW1vdW50IGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byB0aGUgYWxsb3dhbmNlIHRoYXQgdGhlIHNwZW5kZXIKaGFzIG9uIHRoZSBmcm9tJ3MgYmFsYW5jZS4gVGhlIHNwZW5kZXIncyBhbGxvd2FuY2Ugb24gZnJvbSdzIGJhbGFuY2UKd2lsbCBiZSByZWR1Y2VkIGJ5IHRoZSBhbW91bnQuCgojIEFyZ3VtZW50cwoKKiBgc3BlbmRlcmAgLSBUaGUgYWRkcmVzcyBhdXRob3JpemluZyB0aGUgdHJhbnNmZXIsIGFuZCBoYXZpbmcgaXRzCmFsbG93YW5jZSBjb25zdW1lZCBkdXJpbmcgdGhlIHRyYW5zZmVyLgoqIGBmcm9tYCAtIFRoZSBhZGRyZXNzIGhvbGRpbmcgdGhlIGJhbGFuY2Ugb2YgdG9rZW5zIHdoaWNoIHdpbGwgYmUKd2l0aGRyYXduIGZyb20uCiogYHRvYCAtIFRoZSBhZGRyZXNzIHdoaWNoIHdpbGwgcmVjZWl2ZSB0aGUgdHJhbnNmZXJyZWQgdG9rZW5zLgoqIGBhbW91bnRgIC0gVGhlIGFtb3VudCBvZiB0b2tlbnMgdG8gYmUgdHJhbnNmZXJyZWQuCgojIEV2ZW50cwoKRW1pdHMgYW4gZXZlbnQgd2l0aCB0b3BpY3MgYFsidHJhbnNmZXIiLCBmcm9tOiBBZGRyZXNzLCB0bzogQWRkcmVzc10sCmRhdGEgPSBhbW91bnQ6IGkxMjhgAAAAAAAADXRyYW5zZmVyX2Zyb20AAAAAAAAEAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA=="
      ]),
      options
    );
    this.options = options;
  }
  static async deploy(options) {
    return ContractClient.deploy(null, options);
  }
  fromJSON = {
    allowance: this.txFromJSON,
    authorized: this.txFromJSON,
    approve: this.txFromJSON,
    balance: this.txFromJSON,
    burn: this.txFromJSON,
    burn_from: this.txFromJSON,
    clawback: this.txFromJSON,
    decimals: this.txFromJSON,
    mint: this.txFromJSON,
    name: this.txFromJSON,
    set_admin: this.txFromJSON,
    admin: this.txFromJSON,
    set_authorized: this.txFromJSON,
    symbol: this.txFromJSON,
    transfer: this.txFromJSON,
    transfer_from: this.txFromJSON
  };
};

// node_modules/passkey-kit-sdk/src/index.ts
import { Buffer as Buffer3 } from "buffer";
import {
  Client as ContractClient2,
  Spec as ContractSpec2
} from "@stellar/stellar-sdk/minimal/contract";
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer3;
}
var Client2 = class extends ContractClient2 {
  constructor(options) {
    super(
      new ContractSpec2([
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAAITm90Rm91bmQAAAABAAAAAAAAAA1BbHJlYWR5RXhpc3RzAAAAAAAAAgAAAAAAAAAOTWlzc2luZ0NvbnRleHQAAAAAAAMAAAAAAAAADVNpZ25lckV4cGlyZWQAAAAAAAAEAAAAAAAAABJGYWlsZWRTaWduZXJMaW1pdHMAAAAAAAUAAAAAAAAAGEZhaWxlZFBvbGljeVNpZ25lckxpbWl0cwAAAAYAAAAAAAAAGVNpZ25hdHVyZUtleVZhbHVlTWlzbWF0Y2gAAAAAAAAHAAAAAAAAACBDbGllbnREYXRhSnNvbkNoYWxsZW5nZUluY29ycmVjdAAAAAgAAAAAAAAADkpzb25QYXJzZUVycm9yAAAAAAAJ",
        "AAAAAQAAAAAAAAAAAAAAEFNpZ25lckV4cGlyYXRpb24AAAABAAAAAAAAAAEwAAAAAAAD6AAAAAQ=",
        "AAAAAQAAAAAAAAAAAAAADFNpZ25lckxpbWl0cwAAAAEAAAAAAAAAATAAAAAAAAPoAAAD7AAAABMAAAPoAAAD6gAAB9AAAAAJU2lnbmVyS2V5AAAA",
        "AAAAAgAAAAAAAAAAAAAADVNpZ25lclN0b3JhZ2UAAAAAAAACAAAAAAAAAAAAAAAKUGVyc2lzdGVudAAAAAAAAAAAAAAAAAAJVGVtcG9yYXJ5AAAA",
        "AAAAAgAAAAAAAAAAAAAABlNpZ25lcgAAAAAAAwAAAAEAAAAAAAAABlBvbGljeQAAAAAABAAAABMAAAfQAAAAEFNpZ25lckV4cGlyYXRpb24AAAfQAAAADFNpZ25lckxpbWl0cwAAB9AAAAANU2lnbmVyU3RvcmFnZQAAAAAAAAEAAAAAAAAAB0VkMjU1MTkAAAAABAAAA+4AAAAgAAAH0AAAABBTaWduZXJFeHBpcmF0aW9uAAAH0AAAAAxTaWduZXJMaW1pdHMAAAfQAAAADVNpZ25lclN0b3JhZ2UAAAAAAAABAAAAAAAAAAlTZWNwMjU2cjEAAAAAAAAFAAAADgAAA+4AAABBAAAH0AAAABBTaWduZXJFeHBpcmF0aW9uAAAH0AAAAAxTaWduZXJMaW1pdHMAAAfQAAAADVNpZ25lclN0b3JhZ2UAAAA=",
        "AAAAAgAAAAAAAAAAAAAACVNpZ25lcktleQAAAAAAAAMAAAABAAAAAAAAAAZQb2xpY3kAAAAAAAEAAAATAAAAAQAAAAAAAAAHRWQyNTUxOQAAAAABAAAD7gAAACAAAAABAAAAAAAAAAlTZWNwMjU2cjEAAAAAAAABAAAADg==",
        "AAAAAgAAAAAAAAAAAAAACVNpZ25lclZhbAAAAAAAAAMAAAABAAAAAAAAAAZQb2xpY3kAAAAAAAIAAAfQAAAAEFNpZ25lckV4cGlyYXRpb24AAAfQAAAADFNpZ25lckxpbWl0cwAAAAEAAAAAAAAAB0VkMjU1MTkAAAAAAgAAB9AAAAAQU2lnbmVyRXhwaXJhdGlvbgAAB9AAAAAMU2lnbmVyTGltaXRzAAAAAQAAAAAAAAAJU2VjcDI1NnIxAAAAAAAAAwAAA+4AAABBAAAH0AAAABBTaWduZXJFeHBpcmF0aW9uAAAH0AAAAAxTaWduZXJMaW1pdHM=",
        "AAAAAQAAAAAAAAAAAAAAElNlY3AyNTZyMVNpZ25hdHVyZQAAAAAAAwAAAAAAAAASYXV0aGVudGljYXRvcl9kYXRhAAAAAAAOAAAAAAAAABBjbGllbnRfZGF0YV9qc29uAAAADgAAAAAAAAAJc2lnbmF0dXJlAAAAAAAD7gAAAEA=",
        "AAAAAgAAAAAAAAAAAAAACVNpZ25hdHVyZQAAAAAAAAMAAAAAAAAAAAAAAAZQb2xpY3kAAAAAAAEAAAAAAAAAB0VkMjU1MTkAAAAAAQAAA+4AAABAAAAAAQAAAAAAAAAJU2VjcDI1NnIxAAAAAAAAAQAAB9AAAAASU2VjcDI1NnIxU2lnbmF0dXJlAAA=",
        "AAAAAQAAAAAAAAAAAAAAClNpZ25hdHVyZXMAAAAAAAEAAAAAAAAAATAAAAAAAAPsAAAH0AAAAAlTaWduZXJLZXkAAAAAAAfQAAAACVNpZ25hdHVyZQAAAA==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABnNpZ25lcgAAAAAH0AAAAAZTaWduZXIAAAAAAAA=",
        "AAAAAAAAAAAAAAAKYWRkX3NpZ25lcgAAAAAAAQAAAAAAAAAGc2lnbmVyAAAAAAfQAAAABlNpZ25lcgAAAAAAAA==",
        "AAAAAAAAAAAAAAANdXBkYXRlX3NpZ25lcgAAAAAAAAEAAAAAAAAABnNpZ25lcgAAAAAH0AAAAAZTaWduZXIAAAAAAAA=",
        "AAAAAAAAAAAAAAANcmVtb3ZlX3NpZ25lcgAAAAAAAAEAAAAAAAAACnNpZ25lcl9rZXkAAAAAB9AAAAAJU2lnbmVyS2V5AAAAAAAAAA==",
        "AAAAAAAAAAAAAAAUdXBkYXRlX2NvbnRyYWN0X2NvZGUAAAABAAAAAAAAAARoYXNoAAAD7gAAACAAAAAA",
        "AAAAAAAAAAAAAAAMX19jaGVja19hdXRoAAAAAwAAAAAAAAARc2lnbmF0dXJlX3BheWxvYWQAAAAAAAPuAAAAIAAAAAAAAAAKc2lnbmF0dXJlcwAAAAAH0AAAAApTaWduYXR1cmVzAAAAAAAAAAAADWF1dGhfY29udGV4dHMAAAAAAAPqAAAH0AAAAAdDb250ZXh0AAAAAAEAAAPpAAAD7QAAAAAAAAAD"
      ]),
      options
    );
    this.options = options;
  }
  static async deploy({ signer }, options) {
    return ContractClient2.deploy({ signer }, options);
  }
  fromJSON = {
    add_signer: this.txFromJSON,
    update_signer: this.txFromJSON,
    remove_signer: this.txFromJSON,
    update_contract_code: this.txFromJSON
  };
};

// node_modules/passkey-kit/src/kit.ts
import { StrKey, hash, xdr, Keypair, Address, TransactionBuilder, Operation } from "@stellar/stellar-sdk/minimal";

// node_modules/@simplewebauthn/browser/esm/helpers/bufferToBase64URLString.js
function bufferToBase64URLString(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64String = btoa(str);
  return base64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// node_modules/@simplewebauthn/browser/esm/helpers/base64URLStringToBuffer.js
function base64URLStringToBuffer(base64URLString) {
  const base64 = base64URLString.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - base64.length % 4) % 4;
  const padded = base64.padEnd(base64.length + padLength, "=");
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// node_modules/@simplewebauthn/browser/esm/helpers/browserSupportsWebAuthn.js
function browserSupportsWebAuthn() {
  return _browserSupportsWebAuthnInternals.stubThis(globalThis?.PublicKeyCredential !== void 0 && typeof globalThis.PublicKeyCredential === "function");
}
var _browserSupportsWebAuthnInternals = {
  stubThis: (value) => value
};

// node_modules/@simplewebauthn/browser/esm/helpers/toPublicKeyCredentialDescriptor.js
function toPublicKeyCredentialDescriptor(descriptor) {
  const { id } = descriptor;
  return {
    ...descriptor,
    id: base64URLStringToBuffer(id),
    /**
     * `descriptor.transports` is an array of our `AuthenticatorTransportFuture` that includes newer
     * transports that TypeScript's DOM lib is ignorant of. Convince TS that our list of transports
     * are fine to pass to WebAuthn since browsers will recognize the new value.
     */
    transports: descriptor.transports
  };
}

// node_modules/@simplewebauthn/browser/esm/helpers/isValidDomain.js
function isValidDomain(hostname) {
  return (
    // Consider localhost valid as well since it's okay wrt Secure Contexts
    hostname === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(hostname)
  );
}

// node_modules/@simplewebauthn/browser/esm/helpers/webAuthnError.js
var WebAuthnError = class extends Error {
  constructor({ message, code, cause, name }) {
    super(message, { cause });
    Object.defineProperty(this, "code", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
    this.name = name ?? cause.name;
    this.code = code;
  }
};

// node_modules/@simplewebauthn/browser/esm/helpers/identifyRegistrationError.js
function identifyRegistrationError({ error, options }) {
  const { publicKey } = options;
  if (!publicKey) {
    throw Error("options was missing required publicKey property");
  }
  if (error.name === "AbortError") {
    if (options.signal instanceof AbortSignal) {
      return new WebAuthnError({
        message: "Registration ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: error
      });
    }
  } else if (error.name === "ConstraintError") {
    if (publicKey.authenticatorSelection?.requireResidentKey === true) {
      return new WebAuthnError({
        message: "Discoverable credentials were required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
        cause: error
      });
    } else if (
      // @ts-ignore: `mediation` doesn't yet exist on CredentialCreationOptions but it's possible as of Sept 2024
      options.mediation === "conditional" && publicKey.authenticatorSelection?.userVerification === "required"
    ) {
      return new WebAuthnError({
        message: "User verification was required during automatic registration but it could not be performed",
        code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",
        cause: error
      });
    } else if (publicKey.authenticatorSelection?.userVerification === "required") {
      return new WebAuthnError({
        message: "User verification was required but no available authenticator supported it",
        code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
        cause: error
      });
    }
  } else if (error.name === "InvalidStateError") {
    return new WebAuthnError({
      message: "The authenticator was previously registered",
      code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      cause: error
    });
  } else if (error.name === "NotAllowedError") {
    return new WebAuthnError({
      message: error.message,
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: error
    });
  } else if (error.name === "NotSupportedError") {
    const validPubKeyCredParams = publicKey.pubKeyCredParams.filter((param) => param.type === "public-key");
    if (validPubKeyCredParams.length === 0) {
      return new WebAuthnError({
        message: 'No entry in pubKeyCredParams was of type "public-key"',
        code: "ERROR_MALFORMED_PUBKEYCREDPARAMS",
        cause: error
      });
    }
    return new WebAuthnError({
      message: "No available authenticator supported any of the specified pubKeyCredParams algorithms",
      code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
      cause: error
    });
  } else if (error.name === "SecurityError") {
    const effectiveDomain = globalThis.location.hostname;
    if (!isValidDomain(effectiveDomain)) {
      return new WebAuthnError({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: error
      });
    } else if (publicKey.rp.id !== effectiveDomain) {
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rp.id}" is invalid for this domain`,
        code: "ERROR_INVALID_RP_ID",
        cause: error
      });
    }
  } else if (error.name === "TypeError") {
    if (publicKey.user.id.byteLength < 1 || publicKey.user.id.byteLength > 64) {
      return new WebAuthnError({
        message: "User ID was not between 1 and 64 characters",
        code: "ERROR_INVALID_USER_ID_LENGTH",
        cause: error
      });
    }
  } else if (error.name === "UnknownError") {
    return new WebAuthnError({
      message: "The authenticator was unable to process the specified options, or could not create a new credential",
      code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
      cause: error
    });
  }
  return error;
}

// node_modules/@simplewebauthn/browser/esm/helpers/webAuthnAbortService.js
var BaseWebAuthnAbortService = class {
  constructor() {
    Object.defineProperty(this, "controller", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0
    });
  }
  createNewAbortSignal() {
    if (this.controller) {
      const abortError = new Error("Cancelling existing WebAuthn API call for new one");
      abortError.name = "AbortError";
      this.controller.abort(abortError);
    }
    const newController = new AbortController();
    this.controller = newController;
    return newController.signal;
  }
  cancelCeremony() {
    if (this.controller) {
      const abortError = new Error("Manually cancelling existing WebAuthn API call");
      abortError.name = "AbortError";
      this.controller.abort(abortError);
      this.controller = void 0;
    }
  }
};
var WebAuthnAbortService = new BaseWebAuthnAbortService();

// node_modules/@simplewebauthn/browser/esm/helpers/toAuthenticatorAttachment.js
var attachments = ["cross-platform", "platform"];
function toAuthenticatorAttachment(attachment) {
  if (!attachment) {
    return;
  }
  if (attachments.indexOf(attachment) < 0) {
    return;
  }
  return attachment;
}

// node_modules/@simplewebauthn/browser/esm/methods/startRegistration.js
async function startRegistration(options) {
  if (!options.optionsJSON && options.challenge) {
    console.warn("startRegistration() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information.");
    options = { optionsJSON: options };
  }
  const { optionsJSON, useAutoRegister = false } = options;
  if (!browserSupportsWebAuthn()) {
    throw new Error("WebAuthn is not supported in this browser");
  }
  const publicKey = {
    ...optionsJSON,
    challenge: base64URLStringToBuffer(optionsJSON.challenge),
    user: {
      ...optionsJSON.user,
      id: base64URLStringToBuffer(optionsJSON.user.id)
    },
    excludeCredentials: optionsJSON.excludeCredentials?.map(toPublicKeyCredentialDescriptor)
  };
  const createOptions = {};
  if (useAutoRegister) {
    createOptions.mediation = "conditional";
  }
  createOptions.publicKey = publicKey;
  createOptions.signal = WebAuthnAbortService.createNewAbortSignal();
  let credential;
  try {
    credential = await navigator.credentials.create(createOptions);
  } catch (err) {
    throw identifyRegistrationError({ error: err, options: createOptions });
  }
  if (!credential) {
    throw new Error("Registration was not completed");
  }
  const { id, rawId, response, type } = credential;
  let transports = void 0;
  if (typeof response.getTransports === "function") {
    transports = response.getTransports();
  }
  let responsePublicKeyAlgorithm = void 0;
  if (typeof response.getPublicKeyAlgorithm === "function") {
    try {
      responsePublicKeyAlgorithm = response.getPublicKeyAlgorithm();
    } catch (error) {
      warnOnBrokenImplementation("getPublicKeyAlgorithm()", error);
    }
  }
  let responsePublicKey = void 0;
  if (typeof response.getPublicKey === "function") {
    try {
      const _publicKey = response.getPublicKey();
      if (_publicKey !== null) {
        responsePublicKey = bufferToBase64URLString(_publicKey);
      }
    } catch (error) {
      warnOnBrokenImplementation("getPublicKey()", error);
    }
  }
  let responseAuthenticatorData;
  if (typeof response.getAuthenticatorData === "function") {
    try {
      responseAuthenticatorData = bufferToBase64URLString(response.getAuthenticatorData());
    } catch (error) {
      warnOnBrokenImplementation("getAuthenticatorData()", error);
    }
  }
  return {
    id,
    rawId: bufferToBase64URLString(rawId),
    response: {
      attestationObject: bufferToBase64URLString(response.attestationObject),
      clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
      transports,
      publicKeyAlgorithm: responsePublicKeyAlgorithm,
      publicKey: responsePublicKey,
      authenticatorData: responseAuthenticatorData
    },
    type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: toAuthenticatorAttachment(credential.authenticatorAttachment)
  };
}
function warnOnBrokenImplementation(methodName, cause) {
  console.warn(`The browser extension that intercepted this WebAuthn API call incorrectly implemented ${methodName}. You should report this error to them.
`, cause);
}

// node_modules/@simplewebauthn/browser/esm/helpers/browserSupportsWebAuthnAutofill.js
function browserSupportsWebAuthnAutofill() {
  if (!browserSupportsWebAuthn()) {
    return _browserSupportsWebAuthnAutofillInternals.stubThis(new Promise((resolve) => resolve(false)));
  }
  const globalPublicKeyCredential = globalThis.PublicKeyCredential;
  if (globalPublicKeyCredential?.isConditionalMediationAvailable === void 0) {
    return _browserSupportsWebAuthnAutofillInternals.stubThis(new Promise((resolve) => resolve(false)));
  }
  return _browserSupportsWebAuthnAutofillInternals.stubThis(globalPublicKeyCredential.isConditionalMediationAvailable());
}
var _browserSupportsWebAuthnAutofillInternals = {
  stubThis: (value) => value
};

// node_modules/@simplewebauthn/browser/esm/helpers/identifyAuthenticationError.js
function identifyAuthenticationError({ error, options }) {
  const { publicKey } = options;
  if (!publicKey) {
    throw Error("options was missing required publicKey property");
  }
  if (error.name === "AbortError") {
    if (options.signal instanceof AbortSignal) {
      return new WebAuthnError({
        message: "Authentication ceremony was sent an abort signal",
        code: "ERROR_CEREMONY_ABORTED",
        cause: error
      });
    }
  } else if (error.name === "NotAllowedError") {
    return new WebAuthnError({
      message: error.message,
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: error
    });
  } else if (error.name === "SecurityError") {
    const effectiveDomain = globalThis.location.hostname;
    if (!isValidDomain(effectiveDomain)) {
      return new WebAuthnError({
        message: `${globalThis.location.hostname} is an invalid domain`,
        code: "ERROR_INVALID_DOMAIN",
        cause: error
      });
    } else if (publicKey.rpId !== effectiveDomain) {
      return new WebAuthnError({
        message: `The RP ID "${publicKey.rpId}" is invalid for this domain`,
        code: "ERROR_INVALID_RP_ID",
        cause: error
      });
    }
  } else if (error.name === "UnknownError") {
    return new WebAuthnError({
      message: "The authenticator was unable to process the specified options, or could not create a new assertion signature",
      code: "ERROR_AUTHENTICATOR_GENERAL_ERROR",
      cause: error
    });
  }
  return error;
}

// node_modules/@simplewebauthn/browser/esm/methods/startAuthentication.js
async function startAuthentication(options) {
  if (!options.optionsJSON && options.challenge) {
    console.warn("startAuthentication() was not called correctly. It will try to continue with the provided options, but this call should be refactored to use the expected call structure instead. See https://simplewebauthn.dev/docs/packages/browser#typeerror-cannot-read-properties-of-undefined-reading-challenge for more information.");
    options = { optionsJSON: options };
  }
  const { optionsJSON, useBrowserAutofill = false, verifyBrowserAutofillInput = true } = options;
  if (!browserSupportsWebAuthn()) {
    throw new Error("WebAuthn is not supported in this browser");
  }
  let allowCredentials;
  if (optionsJSON.allowCredentials?.length !== 0) {
    allowCredentials = optionsJSON.allowCredentials?.map(toPublicKeyCredentialDescriptor);
  }
  const publicKey = {
    ...optionsJSON,
    challenge: base64URLStringToBuffer(optionsJSON.challenge),
    allowCredentials
  };
  const getOptions = {};
  if (useBrowserAutofill) {
    if (!await browserSupportsWebAuthnAutofill()) {
      throw Error("Browser does not support WebAuthn autofill");
    }
    const eligibleInputs = document.querySelectorAll("input[autocomplete$='webauthn']");
    if (eligibleInputs.length < 1 && verifyBrowserAutofillInput) {
      throw Error('No <input> with "webauthn" as the only or last value in its `autocomplete` attribute was detected');
    }
    getOptions.mediation = "conditional";
    publicKey.allowCredentials = [];
  }
  getOptions.publicKey = publicKey;
  getOptions.signal = WebAuthnAbortService.createNewAbortSignal();
  let credential;
  try {
    credential = await navigator.credentials.get(getOptions);
  } catch (err) {
    throw identifyAuthenticationError({ error: err, options: getOptions });
  }
  if (!credential) {
    throw new Error("Authentication was not completed");
  }
  const { id, rawId, response, type } = credential;
  let userHandle = void 0;
  if (response.userHandle) {
    userHandle = bufferToBase64URLString(response.userHandle);
  }
  return {
    id,
    rawId: bufferToBase64URLString(rawId),
    response: {
      authenticatorData: bufferToBase64URLString(response.authenticatorData),
      clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
      signature: bufferToBase64URLString(response.signature),
      userHandle
    },
    type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: toAuthenticatorAttachment(credential.authenticatorAttachment)
  };
}

// node_modules/passkey-kit/src/kit.ts
var import_base64url = __toESM(require_base64url2(), 1);
import { Buffer as Buffer4 } from "buffer";

// node_modules/passkey-kit/src/base.ts
import { Server } from "@stellar/stellar-sdk/minimal/rpc";
var PasskeyBase = class {
  rpcUrl;
  rpc;
  constructor(rpcUrl) {
    if (rpcUrl) {
      this.rpcUrl = rpcUrl;
      this.rpc = new Server(rpcUrl);
    }
  }
};

// node_modules/passkey-kit/src/kit.ts
import { AssembledTransaction as AssembledTransaction2, basicNodeSigner, DEFAULT_TIMEOUT } from "@stellar/stellar-sdk/minimal/contract";
var PasskeyKit = class extends PasskeyBase {
  walletKeypair;
  walletPublicKey;
  walletWasmHash;
  WebAuthn;
  keyId;
  networkPassphrase;
  wallet;
  constructor(options) {
    const { rpcUrl, networkPassphrase, walletWasmHash, WebAuthn } = options;
    super(rpcUrl);
    this.networkPassphrase = networkPassphrase;
    this.walletKeypair = Keypair.fromRawEd25519Seed(hash(Buffer4.from("kalepail")));
    this.walletPublicKey = this.walletKeypair.publicKey();
    this.walletWasmHash = walletWasmHash;
    this.WebAuthn = WebAuthn || { startRegistration, startAuthentication };
  }
  async createWallet(app, user) {
    const { keyId, keyIdBase64, publicKey } = await this.createKey(app, user);
    const at = await Client2.deploy(
      {
        signer: {
          tag: "Secp256r1",
          values: [
            keyId,
            publicKey,
            [void 0],
            [void 0],
            { tag: "Persistent", values: void 0 }
          ]
        }
      },
      {
        rpcUrl: this.rpcUrl,
        wasmHash: this.walletWasmHash,
        networkPassphrase: this.networkPassphrase,
        publicKey: this.walletPublicKey,
        salt: hash(keyId)
      }
    );
    const contractId = at.result.options.contractId;
    this.wallet = new Client2({
      contractId,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: this.rpcUrl
    });
    await at.sign({
      signTransaction: basicNodeSigner(this.walletKeypair, this.networkPassphrase).signTransaction
    });
    return {
      keyId,
      keyIdBase64,
      contractId,
      signedTx: at.signed
    };
  }
  async createKey(app, user, settings) {
    const now = /* @__PURE__ */ new Date();
    const displayName = `${user} \u2014 ${now.toLocaleString()}`;
    const { rpId, authenticatorSelection = {
      residentKey: "preferred",
      userVerification: "preferred"
    } } = settings || {};
    const { id, response } = await this.WebAuthn.startRegistration({
      optionsJSON: {
        challenge: (0, import_base64url.default)("stellaristhebetterblockchain"),
        rp: {
          id: rpId,
          name: app
        },
        user: {
          id: (0, import_base64url.default)(`${user}:${now.getTime()}:${Math.random()}`),
          name: displayName,
          displayName
        },
        authenticatorSelection,
        pubKeyCredParams: [{ alg: -7, type: "public-key" }]
      }
    });
    if (!this.keyId)
      this.keyId = id;
    return {
      keyId: import_base64url.default.toBuffer(id),
      keyIdBase64: id,
      publicKey: await this.getPublicKey(response)
    };
  }
  async connectWallet(opts) {
    let { keyId, rpId, getContractId, walletPublicKey } = opts || {};
    let keyIdBuffer;
    if (!keyId) {
      const response = await this.WebAuthn.startAuthentication({
        optionsJSON: {
          challenge: (0, import_base64url.default)("stellaristhebetterblockchain"),
          rpId,
          userVerification: "preferred"
        }
      });
      keyId = response.id;
    }
    if (keyId instanceof Uint8Array) {
      keyIdBuffer = Buffer4.from(keyId);
      keyId = (0, import_base64url.default)(keyIdBuffer);
    } else {
      keyIdBuffer = import_base64url.default.toBuffer(keyId);
    }
    if (!this.keyId)
      this.keyId = keyId;
    let contractId = this.encodeContract(this.walletPublicKey, keyIdBuffer);
    try {
      await this.rpc.getContractData(contractId, xdr.ScVal.scvLedgerKeyContractInstance());
    } catch {
      contractId = getContractId && await getContractId(keyId);
    }
    if (!contractId && walletPublicKey) {
      contractId = this.encodeContract(walletPublicKey, keyIdBuffer);
      try {
        await this.rpc.getContractData(contractId, xdr.ScVal.scvLedgerKeyContractInstance());
      } catch {
        contractId = void 0;
      }
    }
    if (!contractId)
      throw new Error("Failed to connect wallet");
    this.wallet = new Client2({
      contractId,
      rpcUrl: this.rpcUrl,
      networkPassphrase: this.networkPassphrase
    });
    return {
      keyId: keyIdBuffer,
      keyIdBase64: keyId,
      contractId
    };
  }
  async signAuthEntry(entry, options) {
    let { rpId, keyId, keypair, policy, expiration } = options || {};
    if ([keyId, keypair, policy].filter((arg) => !!arg).length > 1)
      throw new Error("Exactly one of `options.keyId`, `options.keypair`, or `options.policy` must be provided.");
    const credentials = entry.credentials().address();
    if (!expiration) {
      expiration = credentials.signatureExpirationLedger();
      if (!expiration) {
        const { sequence } = await this.rpc.getLatestLedger();
        expiration = sequence + DEFAULT_TIMEOUT / 5;
      }
    }
    credentials.signatureExpirationLedger(expiration);
    const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer4.from(this.networkPassphrase)),
        nonce: credentials.nonce(),
        signatureExpirationLedger: credentials.signatureExpirationLedger(),
        invocation: entry.rootInvocation()
      })
    );
    const payload = hash(preimage.toXDR());
    let key;
    let val;
    if (policy) {
      key = {
        tag: "Policy",
        values: [policy]
      };
      val = {
        tag: "Policy",
        values: void 0
      };
    } else if (keypair) {
      const signature = keypair.sign(payload);
      key = {
        tag: "Ed25519",
        values: [keypair.rawPublicKey()]
      };
      val = {
        tag: "Ed25519",
        values: [signature]
      };
    } else {
      const authenticationResponse = await this.WebAuthn.startAuthentication({
        optionsJSON: keyId === "any" || !keyId && !this.keyId ? {
          challenge: (0, import_base64url.default)(payload),
          rpId,
          userVerification: "preferred"
        } : {
          challenge: (0, import_base64url.default)(payload),
          rpId,
          allowCredentials: [
            {
              id: keyId instanceof Uint8Array ? (0, import_base64url.default)(Buffer4.from(keyId)) : keyId || this.keyId,
              type: "public-key"
            }
          ],
          userVerification: "preferred"
        }
      });
      key = {
        tag: "Secp256r1",
        values: [import_base64url.default.toBuffer(authenticationResponse.id)]
      };
      val = {
        tag: "Secp256r1",
        values: [
          {
            authenticator_data: import_base64url.default.toBuffer(
              authenticationResponse.response.authenticatorData
            ),
            client_data_json: import_base64url.default.toBuffer(
              authenticationResponse.response.clientDataJSON
            ),
            signature: this.compactSignature(
              import_base64url.default.toBuffer(authenticationResponse.response.signature)
            )
          }
        ]
      };
    }
    const scKeyType = xdr.ScSpecTypeDef.scSpecTypeUdt(
      new xdr.ScSpecTypeUdt({ name: "SignerKey" })
    );
    const scValType = xdr.ScSpecTypeDef.scSpecTypeUdt(
      new xdr.ScSpecTypeUdt({ name: "Signature" })
    );
    const scKey = this.wallet.spec.nativeToScVal(key, scKeyType);
    const scVal = val ? this.wallet.spec.nativeToScVal(val, scValType) : xdr.ScVal.scvVoid();
    const scEntry = new xdr.ScMapEntry({
      key: scKey,
      val: scVal
    });
    switch (credentials.signature().switch().name) {
      case "scvVoid":
        credentials.signature(xdr.ScVal.scvVec([
          xdr.ScVal.scvMap([scEntry])
        ]));
        break;
      case "scvVec":
        credentials.signature().vec()?.[0].map()?.push(scEntry);
        credentials.signature().vec()?.[0].map()?.sort((a, b) => {
          return (a.key().vec()[0].sym() + a.key().vec()[1].toXDR().join("")).localeCompare(
            b.key().vec()[0].sym() + b.key().vec()[1].toXDR().join("")
          );
        });
        break;
      default:
        throw new Error("Unsupported signature");
    }
    return entry;
  }
  async sign(txn, options) {
    if (!(txn instanceof AssembledTransaction2)) {
      try {
        txn = AssembledTransaction2.fromXDR(this.wallet.options, typeof txn === "string" ? txn : txn.toXDR(), this.wallet.spec);
      } catch {
        if (!(txn instanceof AssembledTransaction2)) {
          const built = TransactionBuilder.fromXDR(typeof txn === "string" ? txn : txn.toXDR(), this.networkPassphrase);
          const operation = built.operations[0];
          txn = await AssembledTransaction2.buildWithOp(
            Operation.invokeHostFunction({ func: operation.func }),
            this.wallet.options
          );
        }
      }
    }
    await txn.signAuthEntries({
      address: this.wallet.options.contractId,
      authorizeEntry: (entry) => {
        const clone = xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR());
        return this.signAuthEntry(clone, options);
      }
    });
    return txn;
  }
  addSecp256r1(keyId, publicKey, limits, store, expiration) {
    return this.secp256r1(keyId, publicKey, limits, store, "add_signer", expiration);
  }
  addEd25519(publicKey, limits, store, expiration) {
    return this.ed25519(publicKey, limits, store, "add_signer", expiration);
  }
  addPolicy(policy, limits, store, expiration) {
    return this.policy(policy, limits, store, "add_signer", expiration);
  }
  updateSecp256r1(keyId, publicKey, limits, store, expiration) {
    return this.secp256r1(keyId, publicKey, limits, store, "update_signer", expiration);
  }
  updateEd25519(publicKey, limits, store, expiration) {
    return this.ed25519(publicKey, limits, store, "update_signer", expiration);
  }
  updatePolicy(policy, limits, store, expiration) {
    return this.policy(policy, limits, store, "update_signer", expiration);
  }
  remove(signer) {
    return this.wallet.remove_signer({
      signer_key: this.getSignerKey(signer)
    });
  }
  secp256r1(keyId, publicKey, limits, store, fn, expiration) {
    keyId = typeof keyId === "string" ? import_base64url.default.toBuffer(keyId) : keyId;
    publicKey = typeof publicKey === "string" ? import_base64url.default.toBuffer(publicKey) : publicKey;
    return this.wallet[fn]({
      signer: {
        tag: "Secp256r1",
        values: [
          Buffer4.from(keyId),
          Buffer4.from(publicKey),
          [expiration],
          this.getSignerLimits(limits),
          { tag: store, values: void 0 }
        ]
      }
    });
  }
  ed25519(publicKey, limits, store, fn, expiration) {
    return this.wallet[fn]({
      signer: {
        tag: "Ed25519",
        values: [
          Keypair.fromPublicKey(publicKey).rawPublicKey(),
          [expiration],
          this.getSignerLimits(limits),
          { tag: store, values: void 0 }
        ]
      }
    });
  }
  policy(policy, limits, store, fn, expiration) {
    return this.wallet[fn]({
      signer: {
        tag: "Policy",
        values: [
          policy,
          [expiration],
          this.getSignerLimits(limits),
          { tag: store, values: void 0 }
        ]
      }
    });
  }
  /* LATER 
      - Add a getKeyInfo action to get info about a specific passkey
          Specifically looking for name, type, etc. data so a user could grok what signer mapped to what passkey
  */
  getSignerLimits(limits) {
    if (!limits)
      return [void 0];
    const sdk_limits = [/* @__PURE__ */ new Map()];
    for (const [contract2, signer_keys] of limits.entries()) {
      let sdk_signer_keys;
      if (signer_keys?.length) {
        sdk_signer_keys = [];
        for (const signer_key of signer_keys) {
          sdk_signer_keys.push(
            this.getSignerKey(signer_key)
          );
        }
      }
      sdk_limits[0]?.set(contract2, sdk_signer_keys);
    }
    return sdk_limits;
  }
  getSignerKey({ key: tag, value }) {
    let signer_key;
    switch (tag) {
      case "Policy":
        signer_key = {
          tag,
          values: [value]
        };
        break;
      case "Ed25519":
        signer_key = {
          tag,
          values: [Keypair.fromPublicKey(value).rawPublicKey()]
        };
        break;
      case "Secp256r1":
        signer_key = {
          tag,
          values: [import_base64url.default.toBuffer(value)]
        };
        break;
    }
    return signer_key;
  }
  encodeContract(walletPublicKey, keyIdBuffer) {
    let contractId = StrKey.encodeContract(hash(xdr.HashIdPreimage.envelopeTypeContractId(
      new xdr.HashIdPreimageContractId({
        networkId: hash(Buffer4.from(this.networkPassphrase)),
        contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
          new xdr.ContractIdPreimageFromAddress({
            address: Address.fromString(walletPublicKey).toScAddress(),
            salt: hash(keyIdBuffer)
          })
        )
      })
    ).toXDR()));
    return contractId;
  }
  async getPublicKey(response) {
    let publicKey;
    if (response.publicKey) {
      publicKey = import_base64url.default.toBuffer(response.publicKey);
      publicKey = publicKey?.slice(publicKey.length - 65);
    }
    if (!publicKey || publicKey[0] !== 4 || publicKey.length !== 65) {
      let x;
      let y;
      if (response.authenticatorData) {
        const authenticatorData = import_base64url.default.toBuffer(response.authenticatorData);
        const credentialIdLength = authenticatorData[53] << 8 | authenticatorData[54];
        x = authenticatorData.slice(65 + credentialIdLength, 97 + credentialIdLength);
        y = authenticatorData.slice(100 + credentialIdLength, 132 + credentialIdLength);
      } else {
        const attestationObject = import_base64url.default.toBuffer(response.attestationObject);
        let publicKeykPrefixSlice = Buffer4.from([165, 1, 2, 3, 38, 32, 1, 33, 88, 32]);
        let startIndex = attestationObject.indexOf(publicKeykPrefixSlice);
        startIndex = startIndex + publicKeykPrefixSlice.length;
        x = attestationObject.slice(startIndex, 32 + startIndex);
        y = attestationObject.slice(35 + startIndex, 67 + startIndex);
      }
      publicKey = Buffer4.from([
        4,
        // (0x04 prefix) https://en.bitcoin.it/wiki/Elliptic_Curve_Digital_Signature_Algorithm
        ...x,
        ...y
      ]);
    }
    return publicKey;
  }
  compactSignature(signature) {
    let offset = 2;
    const rLength = signature[offset + 1];
    const r = signature.slice(offset + 2, offset + 2 + rLength);
    offset += 2 + rLength;
    const sLength = signature[offset + 1];
    const s = signature.slice(offset + 2, offset + 2 + sLength);
    const rBigInt = BigInt("0x" + r.toString("hex"));
    let sBigInt = BigInt("0x" + s.toString("hex"));
    const n = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
    const halfN = n / 2n;
    if (sBigInt > halfN)
      sBigInt = n - sBigInt;
    const rPadded = Buffer4.from(rBigInt.toString(16).padStart(64, "0"), "hex");
    const sLowS = Buffer4.from(sBigInt.toString(16).padStart(64, "0"), "hex");
    const concatSignature = Buffer4.concat([rPadded, sLowS]);
    return concatSignature;
  }
};

// node_modules/passkey-kit/src/server.ts
import { xdr as xdr2 } from "@stellar/stellar-sdk/minimal";
var import_base64url2 = __toESM(require_base64url2(), 1);
import { AssembledTransaction as AssembledTransaction3 } from "@stellar/stellar-sdk/minimal/contract";
import { Durability } from "@stellar/stellar-sdk/minimal/rpc";

// node_modules/passkey-kit/package.json
var version = "0.10.19";

// node_modules/passkey-kit/src/server.ts
var PasskeyServer = class extends PasskeyBase {
  launchtubeJwt;
  mercuryJwt;
  mercuryKey;
  launchtubeUrl;
  launchtubeHeaders;
  mercuryProjectName;
  mercuryUrl;
  constructor(options) {
    const {
      rpcUrl,
      launchtubeUrl,
      launchtubeJwt,
      launchtubeHeaders,
      mercuryProjectName,
      mercuryUrl,
      mercuryJwt,
      mercuryKey
    } = options;
    super(rpcUrl);
    if (launchtubeUrl)
      this.launchtubeUrl = launchtubeUrl;
    if (launchtubeJwt)
      this.launchtubeJwt = launchtubeJwt;
    if (launchtubeHeaders)
      this.launchtubeHeaders = launchtubeHeaders;
    if (mercuryProjectName)
      this.mercuryProjectName = mercuryProjectName;
    if (mercuryUrl)
      this.mercuryUrl = mercuryUrl;
    if (mercuryJwt)
      this.mercuryJwt = mercuryJwt;
    if (mercuryKey)
      this.mercuryKey = mercuryKey;
  }
  async getSigners(contractId) {
    if (!this.rpc || !this.mercuryProjectName || !this.mercuryUrl || !this.mercuryJwt && !this.mercuryKey)
      throw new Error("Mercury service not configured");
    const signers = await fetch(`${this.mercuryUrl}/zephyr/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.mercuryJwt ? `Bearer ${this.mercuryJwt}` : this.mercuryKey
      },
      body: JSON.stringify({
        project_name: this.mercuryProjectName,
        mode: {
          Function: {
            fname: "get_signers_by_address",
            arguments: JSON.stringify({
              address: contractId
            })
          }
        }
      })
    }).then(async (res) => {
      if (res.ok)
        return res.json();
      throw await res.json();
    });
    for (const signer of signers) {
      if (signer.storage === "Temporary") {
        try {
          await this.rpc.getContractData(contractId, xdr2.ScVal.scvBytes(import_base64url2.default.toBuffer(signer.key)), Durability.Temporary);
        } catch {
          signer.evicted = true;
        }
      }
    }
    return signers;
  }
  async getContractId(options, index = 0) {
    if (!this.mercuryProjectName || !this.mercuryUrl || !this.mercuryJwt && !this.mercuryKey)
      throw new Error("Mercury service not configured");
    let { keyId, publicKey, policy } = options || {};
    if ([keyId, publicKey, policy].filter((arg) => !!arg).length > 1)
      throw new Error("Exactly one of `options.keyId`, `options.publicKey`, or `options.policy` must be provided.");
    let args;
    if (keyId)
      args = { key: keyId, kind: "Secp256r1" };
    else if (publicKey)
      args = { key: publicKey, kind: "Ed25519" };
    else if (policy)
      args = { key: policy, kind: "Policy" };
    const res = await fetch(`${this.mercuryUrl}/zephyr/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.mercuryJwt ? `Bearer ${this.mercuryJwt}` : this.mercuryKey
      },
      body: JSON.stringify({
        project_name: this.mercuryProjectName,
        mode: {
          Function: {
            fname: "get_addresses_by_signer",
            arguments: JSON.stringify(args)
          }
        }
      })
    }).then(async (res2) => {
      if (res2.ok)
        return await res2.json();
      throw await res2.json();
    });
    return res[index];
  }
  /* LATER
      - Add a method for getting a paginated or filtered list of all a wallet's events
  */
  async send(txn, fee) {
    if (!this.launchtubeUrl)
      throw new Error("Launchtube service not configured");
    const data = new FormData();
    if (txn instanceof AssembledTransaction3) {
      txn = txn.built.toXDR();
    } else if (typeof txn !== "string") {
      txn = txn.toXDR();
    }
    data.set("xdr", txn);
    if (fee)
      data.set("fee", fee.toString());
    let lt_headers = Object.assign({
      "X-Client-Name": "passkey-kit",
      "X-Client-Version": version
    }, this.launchtubeHeaders);
    if (this.launchtubeJwt)
      lt_headers.authorization = `Bearer ${this.launchtubeJwt}`;
    return fetch(this.launchtubeUrl, {
      method: "POST",
      headers: lt_headers,
      body: data
    }).then(async (res) => {
      if (res.ok)
        return res.json();
      else throw await res.json();
    });
  }
};

// src/utils.ts
import dotenv from "dotenv";
import { contract } from "@stellar/stellar-sdk/minimal";
dotenv.config();
var getPasskeyWallet = (walletContractId) => {
  const pkKit = new PasskeyKit({
    rpcUrl: process.env.RPC_URL,
    networkPassphrase: process.env.NETWORK_PASSPHRASE,
    walletWasmHash: process.env.WALLET_WASM_HASH
  });
  pkKit.wallet = new Client2({
    contractId: walletContractId,
    rpcUrl: process.env.RPC_URL,
    networkPassphrase: process.env.NETWORK_PASSPHRASE
  });
  return pkKit;
};
var passkeyServer = new PasskeyServer({
  rpcUrl: process.env.RPC_URL,
  launchtubeUrl: process.env.LAUNCHTUBE_URL,
  launchtubeJwt: process.env.LAUNCHTUBE_JWT,
  mercuryProjectName: process.env.MERCURY_PROJECT_NAME,
  mercuryUrl: process.env.MERCURY_URL,
  mercuryJwt: process.env.MERCURY_JWT
});
var shouldSignWithWalletSigner = async (assembledTransaction, contractId) => {
  const sacClient = await createSACClient(
    contractId,
    process.env.NETWORK_PASSPHRASE,
    process.env.RPC_URL
  );
  const requiredSigners = assembledTransaction.needsNonInvokerSigningBy({
    includeAlreadySigned: false
  });
  let walletContractId = "";
  if (requiredSigners.length > 0) {
    walletContractId = requiredSigners.find((address) => address.startsWith("C")) ?? "";
  }
  return {
    shouldSignWithSigner: walletContractId !== "",
    walletContractId
  };
};
var readMarkdownResource = async (uri, _extra) => {
  const filePath = path.resolve(uri.pathname);
  const content = await fs.readFile(filePath, "utf-8");
  return {
    contents: [
      {
        uri: uri.toString(),
        text: content,
        mimeType: "text/markdown"
        // Or "application/json" depending on the file
      }
    ]
  };
};
var readTxtResource = async (uri, _extra) => {
  const filePath = path.resolve(uri.pathname);
  const content = await fs.readFile(filePath, "utf-8");
  return {
    contents: [
      {
        uri: uri.toString(),
        text: content,
        mimeType: "text/plain"
      }
    ]
  };
};
var submitToLaunchtube = async (xdrTx, fee) => {
  if (!process.env.LAUNCHTUBE_URL)
    throw new Error("Launchtube service not configured");
  const data = new FormData();
  data.set("xdr", xdrTx);
  if (fee) data.set("fee", fee.toString());
  const launchtubeHeaders = {
    "X-Client-Name": "passkey-kit",
    "X-Client-Version": "0.10.19",
    Authorization: `Bearer ${process.env.LAUNCHTUBE_JWT}`
  };
  return fetch(process.env.LAUNCHTUBE_URL, {
    method: "POST",
    headers: launchtubeHeaders,
    body: data
  }).then(async (res) => {
    if (res.ok) return res.json();
    else throw await res.json();
  });
};
var createSACClient = async (contractId, networkPassphrase, rpcUrl) => {
  return new Client({
    contractId,
    rpcUrl,
    networkPassphrase
  });
};

// src/mcp-server.ts
var server = new McpServer({
  name: "stellar-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {}
  }
});
var AGENT_KEYPAIR_FILE_PATH = process.env.AGENT_KEYPAIR_FILE_PATH;
var USAGE_GUIDE_FILE_PATH = process.env.USAGE_GUIDE_FILE_PATH;
var SAC_GUIDE_FILE_PATH = process.env.SAC_GUIDE_FILE_PATH;
if (AGENT_KEYPAIR_FILE_PATH) {
  server.resource(
    "Agent Keys",
    `file:///${AGENT_KEYPAIR_FILE_PATH}`,
    {
      description: "Stellar keypair for the AI Agent",
      mimeType: "text/plain"
    },
    readTxtResource
  );
}
if (USAGE_GUIDE_FILE_PATH) {
  server.resource(
    "MCP Usage Guide",
    `file:///${USAGE_GUIDE_FILE_PATH}`,
    {
      description: "How and when to use Stellar tools and the provided keys",
      mimeType: "text/markdown"
    },
    readMarkdownResource
  );
}
server.resource(
  "Stellar Tokens SAC Guide",
  `file:///${SAC_GUIDE_FILE_PATH}`,
  {
    description: "Guide for interacting with Stellar Asset Contracts (SAC) through the MCP server",
    mimeType: "text/markdown"
  },
  readMarkdownResource
);
server.tool("create-account", "Create a new Stellar account.", {}, async () => {
  try {
    const keypair = Keypair2.random();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              publicKey: keypair.publicKey(),
              secretKey: keypair.secret()
            },
            null,
            2
          )
        }
      ]
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 404) {
      return {
        content: [{ type: "text", text: `Error creating account` }]
      };
    }
    throw error;
  }
});
server.tool(
  "fund-account",
  "Fund a Stellar account with testnet lumens.",
  {
    address: z.string().describe("The Stellar address to fund")
  },
  async ({ address }) => {
    try {
      await fetch(`https://friendbot.stellar.org?addr=${address}`).then((res) => res.json()).then((json) => {
        return json;
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Account funded successfully"
              },
              null,
              2
            )
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === 404) {
        return {
          content: [{ type: "text", text: `Account ${address} not found` }]
        };
      }
      throw error;
    }
  }
);
server.tool(
  "get-account",
  "Fetch a minimal set of current info about a Stellar account.",
  {
    address: z.string().describe("The Stellar address to fetch info for")
  },
  async ({ address }) => {
    try {
      const horizonServer = new Horizon.Server(
        "https://horizon-testnet.stellar.org"
      );
      const account = await horizonServer.loadAccount(address);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: account.id,
                accountId: account.account_id,
                sequence: account.sequence,
                balances: account.balances,
                signers: account.signers
              },
              null,
              2
            )
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === 404) {
        return {
          content: [{ type: "text", text: `Account ${address} not found` }]
        };
      }
      throw error;
    }
  }
);
server.tool(
  "get-transactions",
  "Fetch an array of transactions for a given Stellar address.",
  {
    address: z.string().describe("The Stellar address to fetch transactions for")
  },
  async ({ address }) => {
    try {
      const horizonServer = new Horizon.Server(
        "https://horizon-testnet.stellar.org"
      );
      const transactions = await horizonServer.transactions().forAccount(address).call();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(transactions)
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === 404) {
        return {
          content: [{ type: "text", text: `Account ${address} not found` }]
        };
      }
      throw error;
    }
  }
);
server.tool(
  "sign-and-submit-transaction",
  "Sign and submit a Soroban transaction to the Stellar network.",
  {
    transactionXdr: z.string().describe("The transaction XDR to sign and submit"),
    contractId: z.string().describe("The contract ID to use for the transaction"),
    secretKey: z.string().describe("The secret key of the account to sign the transaction")
  },
  async ({ transactionXdr, contractId, secretKey }) => {
    try {
      if (!contractId.startsWith("C")) {
        throw new Error('Contract ID must start with "C"');
      }
      if (contractId.length !== 56) {
        throw new Error("Contract ID must be 56 characters long");
      }
      const keypair = Keypair2.fromSecret(secretKey);
      const sacClient = await createSACClient(
        contractId.toUpperCase(),
        process.env.NETWORK_PASSPHRASE,
        process.env.RPC_URL
      );
      const result = sacClient.txFromXDR(transactionXdr);
      let isReadCall = false;
      try {
        await result.simulate();
        isReadCall = result.isReadCall;
      } catch (e) {
      }
      if (isReadCall) {
        const res2 = await submitToLaunchtube(result.toXDR());
        const meta2 = xdr3.TransactionMeta.fromXDR(res2.resultMetaXdr, "base64");
        const parsedResult2 = scValToNative(
          meta2.v3().sorobanMeta().returnValue()
        );
        return {
          content: [
            {
              type: "text",
              text: "Transaction sent successfully!"
            },
            {
              type: "text",
              text: JSON.stringify(parsedResult2)
            }
          ]
        };
      }
      const { shouldSignWithSigner, walletContractId } = await shouldSignWithWalletSigner(result, contractId);
      if (shouldSignWithSigner && walletContractId) {
        const passkeyWallet = getPasskeyWallet(walletContractId);
        const signedTx = await passkeyWallet.sign(transactionXdr, {
          keypair
        });
        try {
          const res2 = await passkeyServer.send(signedTx);
          const meta2 = xdr3.TransactionMeta.fromXDR(res2.resultMetaXdr, "base64");
          const parsedResult2 = scValToNative(
            meta2.v3().sorobanMeta().returnValue()
          );
          return {
            content: [
              {
                type: "text",
                text: "Transaction sent successfully!"
              },
              {
                type: "text",
                text: JSON.stringify(parsedResult2)
              }
            ]
          };
        } catch (e) {
          let invalidAuth = false;
          if (e?.error?.includes(
            "Error(Auth, InvalidAction)"
          )) {
            invalidAuth = true;
          }
          return {
            content: [
              {
                type: "text",
                text: invalidAuth ? "Transaction failed: Insufficient permissions to execute the transaction" : "Transaction failed"
              }
            ]
          };
        }
      }
      const server2 = new rpc.Server(process.env.RPC_URL, {
        allowHttp: true
      });
      const ledgerSeq = (await server2.getLatestLedger()).sequence;
      const validUntilLedger = ledgerSeq + 100;
      await result.signAuthEntries({
        address: keypair.publicKey(),
        authorizeEntry: async (entry) => {
          return authorizeEntry(
            entry,
            keypair,
            validUntilLedger,
            process.env.NETWORK_PASSPHRASE
          );
        }
      });
      await result.sign({
        signTransaction: basicNodeSigner2(
          keypair,
          process.env.NETWORK_PASSPHRASE
        ).signTransaction
      });
      const res = await submitToLaunchtube(result.toXDR());
      const meta = xdr3.TransactionMeta.fromXDR(res.resultMetaXdr, "base64");
      const parsedResult = scValToNative(
        meta.v3().sorobanMeta().returnValue()
      );
      return {
        content: [
          {
            type: "text",
            text: "Transaction sent successfully!"
          },
          {
            type: "text",
            text: JSON.stringify(parsedResult)
          }
        ]
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Transaction failed",
                  message: error.message,
                  details: error
                },
                null,
                2
              )
            }
          ]
        };
      }
      throw error;
    }
  }
);
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    throw error;
  }
}
main().catch(() => {
  process.exit(1);
});
