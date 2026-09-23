# Privacy Policy / 개인정보처리방침

**Last updated: 2026-09-23**

---

## English

### Summary

This extension has no analytics and no tracking. The developer never stores the content of your messages.

To classify your messages it sends limited data to a classification service, TypeSafe. You choose how in settings:

| Mode | Where requests go | Whose key |
|---|---|---|
| **Free trial** (the default until you choose) | Through a relay server the developer runs, then to TypeSafe | The developer's |
| **Your own API key** | Straight to TypeSafe. The developer is never involved | Yours |

### What is sent

When you press the **Sort inbox** button, the extension sends the following for each visible message:

- The message subject
- The sender's display name and email address
- The preview snippet shown in the list, where the mail service provides one (up to 500 characters)
- The role description you entered in settings
- Your own name and email address, if you entered them in settings, so that mail you sent yourself is recognised

**Message bodies and attachments are never sent.** Only what is already visible in the message list is used.

Nothing is sent unless you press the button. When the mail service redraws the list, the extension re-draws marks it already has from your browser storage and sends nothing.

### The free trial relay

The relay exists for one reason. **A key placed inside the extension can be read by anyone who installs it**, so the developer's key stays on a server and that server makes the request instead. It is not there to collect anything.

| What the relay does | What it does not do |
|---|---|
| Forwards the request to TypeSafe | Store message content |
| Counts usage against daily limits | Log subjects, senders or previews |
| Returns TypeSafe's response | Try to identify you |

To count usage, the relay keeps two values:

| Value | How long |
|---|---|
| A random identifier created when you install the extension | Up to 90 days after you last use the free trial |
| The IP address of your first request after installing (for IPv6, only the first 64 bits) | Until the end of that day (UTC) |

Expired values are deleted within an hour. Cloudflare keeps a recovery history of this storage for 30 days, so deleted values can be restored by the developer during that time. Neither value is linked to message content. The relay runs on Cloudflare Workers, so requests pass through Cloudflare's network.

**There is no way to verify these promises from outside.** Choosing **your own API key** bypasses the developer entirely. For a work account, that is the better choice.

### What is stored, and where

All of the following is stored **only in your browser** using the Chrome extension storage API. None of it leaves your device except as described above.

| Data | Where | Why |
|---|---|---|
| Your TypeSafe API key, if you use your own | Chrome local storage (this device only) | To authenticate your own requests |
| The random install identifier | Chrome local storage | To count free trial usage |
| Your role description and settings | Chrome sync storage | To classify messages for you specifically |
| Your always-show and always-ignore lists | Chrome sync storage | Applied before any classification. Never transmitted |
| Classification results | Chrome local storage | So repeat runs cost nothing |
| Messages you opened from the list of messages to check | Chrome local storage | So they stay off that list. Deleted after 60 days |
| Detected account name | Chrome local storage | To recognise mail you sent yourself |

Chrome sync storage may be synchronised across your own signed-in Chrome profiles by Google. That is a function of your browser, not of this extension. Your API key is never put there.

You can delete cached classifications at any time from the settings page, and removing the extension deletes everything it stored.

### Third-party service

Classification is performed by TypeSafe AI. With the free trial, requests are made with the developer's key. With your own key, they are made under your own account. TypeSafe's handling of that data is governed by its terms and privacy policy at `typesafe.ai`. This project is not affiliated with TypeSafe AI.

### Permissions

| Permission | Why |
|---|---|
| `storage` | To save your settings and cached results in your browser |
| Access to `mail.google.com`, `mail.naver.com`, `*.worksmobile.com` | To read the message list on the page and add visual marks to it |
| Access to `api.typesafe.ai` | To send classification requests with your own key |
| Access to `mail-triage-relay.ejoongseok.workers.dev` | To send free trial requests through the relay |

The extension never modifies, moves, deletes, or marks your messages. It only adds visual indicators to the page.

### Using this at work

Subject lines and sender names often contain client names, contract references and internal project names. If you are using a work account, check your organisation's information security policy before enabling this extension, and prefer your own API key.

### Contact

Report issues or ask questions through the GitHub repository's issue tracker.

---

## 한국어

### 요약

이 확장에는 분석 도구나 추적 기능이 없습니다. 개발자는 메일 내용을 저장하지 않습니다.

메일을 분류하기 위해 판정 서비스인 TypeSafe 에 제한된 정보를 보냅니다. 보내는 방식은 설정에서 고릅니다.

| 방식 | 요청이 가는 곳 | 쓰는 키 |
|---|---|---|
| **무료 체험** (고르기 전의 기본값) | 개발자가 운영하는 중계 서버를 거쳐 TypeSafe 로 | 개발자의 키 |
| **내 API 키** | TypeSafe 로 바로. 개발자를 거치지 않습니다 | 사용자 본인의 키 |

### 무엇을 보내는가

**분류하기** 버튼을 누르면 화면에 보이는 메일마다 아래 정보를 보냅니다.

- 메일 제목
- 발신자 이름과 메일 주소
- 목록에 미리보기가 있는 경우 그 일부(최대 500자)
- 설정에 입력한 역할 문장
- 사용자 본인의 이름과 메일 주소(설정에 입력한 경우). 본인이 보낸 메일을 알아보기 위해서입니다

**본문과 첨부파일은 보내지 않습니다.** 이미 메일 목록 화면에 보이는 것만 사용합니다.

버튼을 누르지 않으면 아무것도 보내지 않습니다. 메일 서비스가 목록을 새로 그리면 이미 받아 둔 판정을 브라우저 저장소에서 읽어 다시 표시할 뿐이고, 전송은 일어나지 않습니다.

### 무료 체험의 중계 서버

중계 서버가 있는 이유는 하나입니다. **개발자 키를 확장 안에 넣으면 설치한 사람이 소스에서 그대로 꺼내 쓸 수 있기 때문입니다.** 그래서 키는 서버에만 두고, 그 서버가 대신 요청을 보냅니다. 데이터를 모으려고 두는 장치가 아닙니다.

| 중계 서버가 하는 일 | 하지 않는 일 |
|---|---|
| 요청을 TypeSafe 로 넘김 | 메일 내용을 저장하지 않음 |
| 하루 한도를 셈 | 제목과 발신자와 미리보기를 기록하지 않음 |
| TypeSafe 의 응답을 돌려줌 | 사용자가 누구인지 알아내려 하지 않음 |

한도를 세려고 중계 서버가 보관하는 값은 둘입니다.

| 값 | 보관 기간 |
|---|---|
| 확장을 설치할 때 만들어지는 임의의 식별자 | 무료 체험을 마지막으로 쓴 날부터 최대 90일 |
| 설치 후 첫 요청의 IP 주소(IPv6 는 앞 64비트만) | 그날이 끝날 때까지(UTC 기준, 한국 시간으로 다음 날 오전 9시) |

기한이 지난 값은 한 시간 안에 지웁니다. 다만 Cloudflare 가 이 저장소의 복구 기록을 30일 동안 두므로, 지운 값도 그 기간에는 개발자가 되살릴 수 있습니다. 둘 다 메일 내용과 이어지지 않습니다. 중계 서버는 Cloudflare Workers 에서 돌아가므로 요청은 Cloudflare 네트워크를 지납니다.

**이 약속을 외부에서 확인할 방법은 없습니다.** 설정에서 **내 API 키**를 고르면 개발자를 아예 거치지 않습니다. 업무 계정이라면 그쪽을 권합니다.

### 무엇이 어디에 저장되는가

아래 항목은 전부 크롬 확장 저장소를 통해 **사용자의 브라우저에만** 저장됩니다. 위에 적은 경우를 제외하고 기기 밖으로 나가지 않습니다.

| 항목 | 저장 위치 | 이유 |
|---|---|---|
| TypeSafe API 키(내 키를 쓰는 경우) | 크롬 로컬 저장소(이 기기에만) | 본인 요청을 인증하기 위해 |
| 임의의 설치 식별자 | 크롬 로컬 저장소 | 무료 체험 사용량을 세기 위해 |
| 역할 문장과 설정 | 크롬 동기화 저장소 | 사용자에게 맞춘 판정을 하기 위해 |
| 항상 확인과 항상 무시 목록 | 크롬 동기화 저장소 | 판정보다 먼저 적용하기 위해. 전송되지 않습니다 |
| 판정 결과 | 크롬 로컬 저장소 | 다시 실행할 때 비용이 들지 않도록 |
| 확인 목록에서 열어 본 메일 | 크롬 로컬 저장소 | 확인 목록에서 계속 빠져 있도록. 60일 뒤 삭제 |
| 감지한 계정 이름 | 크롬 로컬 저장소 | 본인이 보낸 메일을 알아보기 위해 |

크롬 동기화 저장소는 같은 계정으로 로그인한 본인의 다른 크롬에 구글이 동기화할 수 있습니다. 이는 브라우저의 기능이며 이 확장이 하는 일이 아닙니다. API 키는 그곳에 두지 않습니다.

설정 화면에서 저장된 판정을 언제든 비울 수 있고, 확장을 삭제하면 저장된 내용도 모두 지워집니다.

### 제3자 서비스

판정은 TypeSafe AI 가 수행합니다. 무료 체험에서는 개발자의 키로, 내 API 키를 쓰면 사용자 본인 계정으로 요청합니다. 해당 데이터의 취급은 `typesafe.ai` 의 약관과 개인정보처리방침을 따릅니다. 이 프로젝트는 TypeSafe AI 와 제휴 관계가 없습니다.

### 권한

| 권한 | 이유 |
|---|---|
| `storage` | 설정과 판정 결과를 브라우저에 저장하기 위해 |
| `mail.google.com`, `mail.naver.com`, `*.worksmobile.com` 접근 | 화면의 메일 목록을 읽고 표시를 덧붙이기 위해 |
| `api.typesafe.ai` 접근 | 내 키로 판정을 요청하기 위해 |
| `mail-triage-relay.ejoongseok.workers.dev` 접근 | 무료 체험 요청을 중계 서버로 보내기 위해 |

이 확장은 메일을 수정하거나 옮기거나 지우거나 읽음 처리하지 않습니다. 화면에 표시만 덧붙입니다.

### 업무 계정에서 쓸 때

메일 제목과 발신자에는 고객사 이름과 계약 건명, 내부 프로젝트명이 들어 있는 경우가 많습니다. 업무 계정에서 쓰신다면 소속 조직의 정보보안 정책을 먼저 확인하시고, 내 API 키를 쓰시기를 권합니다.

### 문의

GitHub 저장소의 이슈로 문의하십시오.
