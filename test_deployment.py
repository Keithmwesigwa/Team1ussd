import importlib


def test_wsgi_entrypoint_is_exposed():
    module = importlib.import_module('api.index')
    assert module.app is not None
    assert getattr(module, 'application', None) is module.app
