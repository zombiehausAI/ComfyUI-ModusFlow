import random
import time

class ModusFlowSeedController:
    """
    A centralized master seed controller for ComfyUI-ModusFlow.
    Distributes a synchronized seed across KSampler, Text Editor dynamic choices,
    and LoRA Random Pools with multiple workflow modes (randomize, fixed, increment, decrement).
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "action": (["randomize", "fixed", "increment", "decrement"], {"default": "randomize"}),
            }
        }

    RETURN_TYPES = ("INT", "STRING")
    RETURN_NAMES = ("seed", "seed_text")
    FUNCTION = "get_seed"
    CATEGORY = "ModusFlow/Utilities"

    @classmethod
    def IS_CHANGED(cls, seed, action, **kwargs):
        if action in ("randomize", "increment", "decrement"):
            return time.time()
        return seed

    def get_seed(self, seed: int, action: str):
        if action == "randomize":
            actual_seed = random.randint(0, 0xffffffffffffffff)
        elif action == "increment":
            actual_seed = (seed + 1) & 0xffffffffffffffff
        elif action == "decrement":
            actual_seed = (seed - 1) & 0xffffffffffffffff if seed > 0 else 0
        else:
            actual_seed = seed

        return (actual_seed, str(actual_seed))

NODE_CLASS_MAPPINGS = {
    "ModusFlowSeedController": ModusFlowSeedController
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowSeedController": "ModusFlow Master Seed"
}
