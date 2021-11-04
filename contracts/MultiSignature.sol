//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import './interfaces/IERC20.sol';

/// @title MultiSignature contract for Splinterlands
/// @author @fbslo
/// @notice Multisignature contract that only allows changes if enough valid signatures are used

contract MultiSignature {
  /// @notice Address of the token contract
  address public tokenContract;
  /// @notice Required threshold in percents
  uint256 public threshold = 80;
  /// @notice Array of all active validators
  address[] public validators;
  /// @notice A record of states if address is validator
  mapping(address => bool) public isValidator;
  /// @notice A record of states if string was already uses as a reference
  mapping(string => bool) public isAlreadyApproved;
  /// @notice A record of states if nonce was already used
  mapping(uint256 => bool) isNonceUsed;
  /// @notice A record of states if certain validator address already signed a transaction
  mapping(address => bool) validatorAlreadySigned;
  /// @notice A record of states if signature was already used
  mapping(address => bool) isSignatureUsed;

  /// @notice Emitted when tokens are transferred
  event Transferred(address indexed to, uint256 amount, string indexed referenceString);
  /// @notice Emitted when new validator is added
  event ValidatorAdded(address indexed validator);
  /// @notice Emitted when validator is removed
  event ValidatorRemoved(address indexed validator);
  /// @notice Emitted when threshold is updated
  event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

  /**
   * @notice Construct a new MultiSignature contract
   * @param newValidators An array of addresses with validator rights
   * @param newTokenContract The address of the token
   */
  constructor(address[] memory newValidators, address newTokenContract) {
      require(newValidators.length > 0, "Validators required");
      require(newValidators.length <= 40, "Max 40 validators");

      for (uint256 i = 0; i < newValidators.length; i++) {
          address validator = newValidators[i];

          require(validator != address(0), "Invalid validator");
          require(!isValidator[validator], "Validator not unique");

          isValidator[validator] = true;
          validators.push(validator);
      }
      tokenContract = newTokenContract;
  }

  /**
   * @notice Transfer tokens from this contract to another address, has to be approved with enough valid signatures
   * @param signatures An array of signatures from validators
   * @param to The address of the account receiving the tokens
   * @param amount The amount of tokens to send
   * @param referenceString The reference string to identify transactions (e.g. hive transaction hash for cross-chain transfers)
   */
  function transfer(bytes[] memory signatures, address to, uint256 amount, string memory referenceString) external {
      require(!isAlreadyApproved[referenceString], 'Reference already used');

      bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(to, amount, referenceString))));
      require(areSignaturesValid(signatures, messageHash), 'Signatures not valid/threshold not reached');
      isAlreadyApproved[referenceString] = true;

      IERC20(tokenContract).transfer(to, amount);
      emit Transferred(to, amount, referenceString);
  }

  /**
   * @notice Add new validator
   * @param signatures An array of signatures from validators
   * @param newValidator The address of the new validator
   * @param nonce The unique number used only once, to prevent replay attacks
   */
  function addValidator(bytes[] memory signatures, address newValidator, uint256 nonce) external {
    require(!isNonceUsed[nonce], 'Nonce already used');
    require(!isValidator[newValidator], 'Validator already exists');

    bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(newValidator, nonce))));
    require(areSignaturesValid(signatures, messageHash), 'Signatures not valid/threshold not reached');

    isValidator[newValidator] = true;
    validators.push(newValidator);

    emit ValidatorAdded(newValidator);
  }

  /**
   * @notice Remove a validator
   * @param signatures An array of signatures from validators
   * @param validatorAddress The address of the validator to remove
   * @param nonce The unique number used only once, to prevent replay attacks
   */
  function removeValidator(bytes[] memory signatures, address validatorAddress, uint256 nonce) external {
    require(!isNonceUsed[nonce], 'Nonce already used');
    require(isValidator[validatorAddress], 'Validator does not exists');

    bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(validatorAddress, nonce))));
    require(areSignaturesValid(signatures, messageHash), 'Signatures not valid/threshold not reached');

    isValidator[validatorAddress] = false;

    for (uint256 i = 0; i < validators.length; i++){
      if (validators[i] == validatorAddress) delete validators[i];
    }

    emit ValidatorRemoved(validatorAddress);
  }

  /**
   * @notice Update required signature threshold
   * @param signatures An array of signatures from validators
   * @param newThreshold The new required threshold, in percents
   * @param nonce The unique number used only once, to prevent replay attacks
   */
  function updateThreshold(bytes[] memory signatures, uint256 newThreshold, uint256 nonce) external {
    require(!isNonceUsed[nonce], 'Nonce already used');

    bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(newThreshold, nonce))));
    require(areSignaturesValid(signatures, messageHash), 'Signatures not valid/threshold not reached');

    uint256 oldThreshold = threshold;
    threshold = newThreshold;

    emit ThresholdUpdated(oldThreshold, threshold);
  }

  /**
   * @notice Verify signatures is valid
   * @param signatures An array of signatures from validators
   * @param messageHash The unique number used only once, to prevent replay attacks
   * @return Boolean, true if signatures are valid and their length is over the threshold, false otherwise
   */
  function areSignaturesValid(bytes[] memory signatures, bytes32 messageHash) public returns(bool) {
    uint256 isApproved = 0;
    address[] memory signers = new address[](signatures.length);

    for (uint i = 0; i < signatures.length; i++) {
      address signer = recoverSigner(messageHash, signatures[i]);
      if (isValidator[signer] && !isSignatureUsed[signer] && !validatorAlreadySigned[signer]){
        isSignatureUsed[signer] = true;
        validatorAlreadySigned[signer] = true;
        signers[i] = signer;
        isApproved++;
      }
    }

    //Clear the mappings, so same signature can be used again (e.g. if threshold requirement failed)
    for (uint i = 0; i < signers.length; i++){
      isSignatureUsed[signers[i]] = false;
      validatorAlreadySigned[signers[i]] = false;
    }

    if (isApproved >= (validators.length * threshold) / 100){
      return true;
    } else {
      return false;
    }
  }

  /**
   * @notice Recover signer address from signature
   * @param hash Hash of the message signed
   * @param signature The signature from validators
   * @return The address of the signer, address(0) if signature is invalid
   */
  function recoverSigner(bytes32 hash, bytes memory signature) private pure returns (address){
      bytes32 r;
      bytes32 s;
      uint8 v;

      if (signature.length != 65) {
          return (address(0));
      }

      assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
          v := byte(0, mload(add(signature, 0x60)))
      }

      if (v < 27) {
          v += 27;
      }

      if (v != 27 && v != 28) {
          return (address(0));
      } else {
          return ecrecover(hash, v, r, s);
      }
  }

  /**
   * @notice Helper function to make it easier for validator application to get hash of the message to sign.
   * @param to The address of the account receiving the tokens
   * @param amount The amount of tokens to send
   * @param referenceString The reference string to identify transactions (e.g. hive transaction hash for cross-chain transfers)
   * @return Keccak256 hash of the message
   */
  function getMessageHash(address to, uint256 amount, string memory referenceString) public pure returns(bytes32) {
      return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(to, amount, referenceString))));
  }

  /**
   * @notice Helper function return length of the valiators array.
   * @return Length of the validators array
   */
  function getValidatorsLength() public view returns(uint256) {
    return validators.length;
  }
}
